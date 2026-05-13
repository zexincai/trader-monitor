import { Router } from "express";
import { getLatestSnapshots, getLatestPositions } from "../services/storage.js";
import { analyzeNews } from "../services/llm.js";
import { exec } from "child_process";
import { promisify } from "util";

const router = Router();
const execP = promisify(exec);

function escapeArg(arg) {
  if (/^[a-zA-Z0-9_,.:/@%+=\-]+$/.test(String(arg))) return String(arg);
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}

async function runOkx(args) {
  const cmd = "okx " + args.map(escapeArg).join(" ");
  console.log("[daily-report] okx", cmd);
  try {
    const { stdout } = await execP(cmd, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (err) {
    console.error("[daily-report] okx error:", err.message);
    return null;
  }
}

async function fetchChineseTitle(sourceUrl) {
  if (!sourceUrl) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && /[一-鿿]/.test(titleMatch[1])) {
      return titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    }
    return null;
  } catch {
    return null;
  }
}

// GET /api/daily-report — 每日综合报告
router.get("/", async (req, res) => {
  try {
    // 1. 交易员快照数据
    const snapshots = await getLatestSnapshots();

    // 2. 持仓数据
    let positions = [];
    try {
      positions = await getLatestPositions();
    } catch (err) {
      console.error("[daily-report] positions error:", err.message);
    }

    // 3. 计算汇总统计
    const totalTraders = snapshots.length;
    const totalPnl30d = snapshots.reduce((s, t) => s + Number(t.pnl_30d || 0), 0);
    const avgWinRate = totalTraders > 0
      ? snapshots.reduce((s, t) => s + Number(t.win_ratio || 0), 0) / totalTraders
      : 0;
    const avgDrawdown = totalTraders > 0
      ? snapshots.reduce((s, t) => s + Number(t.max_drawdown || 0), 0) / totalTraders
      : 0;
    const totalAum = snapshots.reduce((s, t) => s + Number(t.asset || 0), 0);

    const longCount = positions.filter(p => p.direction === "long").length;
    const shortCount = positions.filter(p => p.direction === "short").length;
    const totalUpl = positions.reduce((s, p) => s + Number(p.upl || 0), 0);
    const totalNotional = positions.reduce((s, p) => s + Number(p.notional_usd || 0), 0);

    // 4. 获取最新新闻用于 AI 分析
    let newsResult = null;
    try {
      newsResult = await runOkx([
        "news", "important",
        "--lang", "zh-CN",
        "--limit", "10",
        "--json",
      ]);
    } catch (err) {
      console.error("[daily-report] news fetch error:", err.message);
    }

    // 5. AI 分析（异步，失败不影响报告）
    let aiAnalysis = null;
    if (newsResult?.details?.length) {
      try {
        const enriched = await Promise.all(
          newsResult.details.slice(0, 10).map(async (item) => {
            if (item.sourceUrl) {
              const cnTitle = await fetchChineseTitle(item.sourceUrl);
              if (cnTitle) {
                item.cnTitle = cnTitle.replace(/\s*[-_|]\s*(OKX|Odaily|PANews|BlockBeats|Foresight).*$/i, "");
              }
            }
            return item;
          })
        );
        console.log("[daily-report] 调用 DeepSeek 分析...");
        aiAnalysis = await analyzeNews(enriched);
        console.log("[daily-report] AI 分析完成");
      } catch (err) {
        console.error("[daily-report] AI 分析失败:", err.message);
      }
    }

    // 6. Top 交易员
    const topByPnl = [...snapshots]
      .sort((a, b) => Number(b.pnl_30d) - Number(a.pnl_30d))
      .slice(0, 5);
    const topByWinRate = [...snapshots]
      .sort((a, b) => Number(b.win_ratio) - Number(a.win_ratio))
      .slice(0, 5);

    // 7. 风险预警
    const alerts = [];
    for (const t of snapshots) {
      if (Number(t.max_drawdown) > 0.3) {
        alerts.push({ trader: t.nick_name, type: "HIGH_DRAWDOWN", msg: `最大回撤 ${(Number(t.max_drawdown)*100).toFixed(1)}%`, level: "warning" });
      }
      if (Number(t.lever_trend) > 20) {
        alerts.push({ trader: t.nick_name, type: "HIGH_LEVERAGE", msg: `杠杆趋势 ${t.lever_trend}x`, level: "danger" });
      }
    }
    if (positions.length > 0) {
      const highUplNeg = positions.filter(p => Number(p.upl) < -10000);
      if (highUplNeg.length) {
        alerts.push({ type: "LARGE_LOSS", msg: `${highUplNeg.length} 个仓位浮亏超 $10,000`, level: "danger" });
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);

    res.json({
      code: 0,
      data: {
        date: dateStr,
        generatedAt: new Date().toISOString(),
        summary: {
          totalTraders,
          totalPnl30d,
          avgWinRate,
          avgDrawdown,
          totalAum,
        },
        positions: {
          total: positions.length,
          longCount,
          shortCount,
          totalUpl,
          totalNotional,
        },
        topByPnl: topByPnl.map(t => ({
          name: t.nick_name,
          pnl30d: Number(t.pnl_30d || 0),
          winRate: Number(t.win_ratio || 0),
          pnlRatio: Number(t.pnl_ratio || 0),
          aum: Number(t.asset || 0),
          drawdown: Number(t.max_drawdown || 0),
        })),
        topByWinRate: topByWinRate.map(t => ({
          name: t.nick_name,
          winRate: Number(t.win_ratio || 0),
          pnl30d: Number(t.pnl_30d || 0),
          pnlRatio: Number(t.pnl_ratio || 0),
          drawdown: Number(t.max_drawdown || 0),
        })),
        alerts,
        aiAnalysis,
      },
    });
  } catch (err) {
    console.error("[daily-report] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

/**
 * 交易员监控核心逻辑
 *
 * 基于 okx CLI 1.3.3 smartmoney 命令：
 *   traders-by-filter      → 牛人榜（筛选+排行）
 *   performance-by-trader  → 交易员 leaderboard 数据
 *   trader-positions       → 当前持仓
 *   trader-orders-history  → 历史成交
 */
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as storage from "./storage.js";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "config.json");
const REPORT_DIR = path.join(__dirname, "..", "reports");

// ── 工具函数 ──

export function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v / 1e4).toFixed(2)}万`;
  return `$${v.toFixed(2)}`;
}

export function fmtPct(n) {
  const v = Number(n);
  return isFinite(v) ? `${(v * 100).toFixed(1)}%` : "N/A";
}

function fmtNum(n, d = 2) {
  const v = Number(n);
  return isFinite(v) ? v.toFixed(d) : "N/A";
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`config.json not found at ${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

// ── 数据采集 ──

async function runOkx(args) {
  const safeArgs = args.map(String);
  try {
    const { stdout } = await execFileP("okx", safeArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (err) {
    console.error(`  [ERR] okx ${args.slice(0, 4).join(" ")} 失败:`, err.message.trim());
    return null;
  }
}

// 一次性获取所有交易员的 leaderboard profile
async function fetchAllProfiles(authorIds) {
  const result = await runOkx([
    "smartmoney", "performance-by-trader",
    "--authorIds", authorIds.join(","),
    "--period", "30",
    "--json",
  ]);
  const list = result?.data || [];
  const map = new Map();
  for (const p of list) {
    map.set(p.authorId, p);
  }
  return map;
}

// 获取单个交易员详情（profile + 持仓 + 成交）
async function fetchTraderDetail(authorId) {
  const [posResult, tradesResult] = await Promise.all([
    runOkx(["smartmoney", "trader-positions", "--authorId", authorId, "--json"]),
    runOkx(["smartmoney", "trader-orders-history", "--authorId", authorId, "--limit", "50", "--json"]),
  ]);
  return {
    profile: {},
    positions: posResult?.data || [],
    trades: tradesResult?.data || [],
  };
}

// ── 策略分析 ──

export function analyzeTrader(raw) {
  const { profile, positions, trades } = raw;
  const now = Date.now();
  const DAY2 = 2 * 86400000;
  const WEEK = 7 * 86400000;
  const MONTH = 30 * 86400000;

  // 按时间窗口分组成交记录
  function inWindow(items, ms) {
    return items.filter((t) => {
      const tMs = Number(t.fillTime || t.uTime || t.cTime);
      return tMs && now - tMs <= ms;
    });
  }

  const trades2d = inWindow(trades, DAY2);
  const trades1w = inWindow(trades, WEEK);
  const trades1m = inWindow(trades, MONTH);

  // ── 持仓分析 ──
  const longPositions = positions.filter((p) => p.direction === "long");
  const shortPositions = positions.filter((p) => p.direction === "short");
  const totalNotional = positions.reduce((s, p) => s + Number(p.notionalUsd || 0), 0);

  // unrealized PnL: 新 API 的 positions[].pnl 是已实现盈亏，浮盈亏需通过 last vs avgPx 估算
  // positionIntensity 表示仓位强度
  function calcUpl(p) {
    if (p.upl !== undefined) return Number(p.upl);
    // 估算: (last - avgPx) * pos
    const pos = Number(p.pos || 0);
    const last = Number(p.last || 0);
    const avgPx = Number(p.avgPx || 0);
    if (pos && last && avgPx) return (last - avgPx) * pos;
    return 0;
  }

  const totalUpl = positions.reduce((s, p) => s + calcUpl(p), 0);

  const posCoins = positions.map((p) => ({
    instId: p.instId || "",
    direction: p.direction || "",
    size: Number(p.pos || 0),
    notional: Number(p.notionalUsd || 0),
    avgPx: Number(p.avgPx || 0),
    last: Number(p.last || 0),
    lever: Number(p.lever || 0),
    upl: calcUpl(p),
    intensity: Number(p.positionIntensity || 0),
  }));

  // ── 交易风格分析 ──
  function analyzeTrades(tradeList) {
    if (!tradeList.length) return { buyCount: 0, sellCount: 0, marketCount: 0, limitCount: 0, totalValue: 0, coins: {} };
    const coinMap = {};
    let buyCount = 0, sellCount = 0, marketCount = 0, limitCount = 0, totalValue = 0;
    for (const t of tradeList) {
      const side = t.side;
      if (side === "buy") buyCount++;
      else if (side === "sell") sellCount++;
      (t.ordType === "market") ? marketCount++ : limitCount++;
      const val = Number(t.value || 0);
      totalValue += val;
      const coin = t.baseName || t.instId || "unknown";
      if (!coinMap[coin]) coinMap[coin] = { count: 0, buyValue: 0, sellValue: 0 };
      coinMap[coin].count++;
      if (side === "buy") coinMap[coin].buyValue += val;
      else coinMap[coin].sellValue += val;
    }
    return { buyCount, sellCount, marketCount, limitCount, totalValue, coins: coinMap };
  }

  const trade2d = analyzeTrades(trades2d);
  const trade1w = analyzeTrades(trades1w);
  const trade1m = analyzeTrades(trades1m);

  // ── 盈亏分析（基于 leaderboard profile，不再有逐笔平仓记录） ──
  // profile 中已有 30 天总览: pnl, pnlRatio, winRatio, maxRetreat
  // 不再能按时间窗口拆分平仓盈亏

  // ── 风险画像 ──
  const levers = trades.slice(0, 50).map((o) => Number(o.lever || 1));
  const maxLever = levers.length ? Math.max(...levers) : 0;
  const avgLever = levers.length ? levers.reduce((a, b) => a + b, 0) / levers.length : 0;

  // 杠杆趋势：比较最近10笔和最远10笔
  const recent10Lever = levers.slice(0, 10);
  const older10Lever = levers.slice(-10);
  const avgRecentLever = recent10Lever.length ? recent10Lever.reduce((a, b) => a + b, 0) / recent10Lever.length : 0;
  const avgOlderLever = older10Lever.length ? older10Lever.reduce((a, b) => a + b, 0) / older10Lever.length : 0;
  const leverTrend = avgRecentLever > avgOlderLever * 1.15 ? "↑ 激进" : avgRecentLever < avgOlderLever * 0.85 ? "↓ 保守" : "→ 持平";

  return {
    profile: {
      authorId: profile.authorId || "",
      nickName: profile.nickName || "N/A",
      pnl: Number(profile.pnl || 0),
      pnlRatio: Number(profile.pnlRatio || 0),
      winRate: Number(profile.winRate || 0),
      maxDrawdown: Number(profile.maxDrawdown || 0),
      asset: Number(profile.asset || 0),
      onboardDuration: Number(profile.onboardDuration || 0),
    },
    positions: { total: positions.length, longCount: longPositions.length, shortCount: shortPositions.length, totalNotional, totalUpl, coins: posCoins },
    trading: { d2: trade2d, w1: trade1w, m1: trade1m },
    pnl: {
      // 新 API 不再有逐笔平仓记录，盈亏数据来自 leaderboard profile
      d2: { totalPnl: 0, winRate: 0, count: 0, bestCoin: null, worstCoin: null },
      w1: { totalPnl: 0, winRate: 0, count: 0, bestCoin: null, worstCoin: null },
      m1: { totalPnl: Number(profile.pnl || 0), winRate: Number(profile.winRate || 0), count: 0, bestCoin: null, worstCoin: null, byCoin: {} },
    },
    risk: { maxDrawdown: Number(profile.maxDrawdown || 0), maxLever, avgLever, avgRecentLever, avgOlderLever, leverTrend },
  };
}

// ── 日间对比 ──

function loadYesterdayReport() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);
  const f = path.join(REPORT_DIR, `trader-report-${y}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf-8"));
  return null;
}

function compareDayOverDay(analysis, yesterdayData) {
  if (!yesterdayData?.traders) return null;
  const prev = yesterdayData.traders.find((t) => t.authorId === analysis.profile.authorId);
  if (!prev) return null;
  const curCoins = analysis.positions.coins.map((c) => c.instId).sort();
  const prevCoins = (prev.positions?.coins || []).map((c) => c.instId).sort();
  const newCoins = curCoins.filter((c) => !prevCoins.includes(c));
  const closedCoins = prevCoins.filter((c) => !curCoins.includes(c));
  const sameCoins = curCoins.filter((c) => prevCoins.includes(c));
  const changes = [];
  for (const coin of sameCoins) {
    const cur = analysis.positions.coins.find((c) => c.instId === coin);
    const pr = (prev.positions?.coins || []).find((c) => c.instId === coin);
    if (cur && pr && Math.abs(cur.size - pr.size) > 0.001) {
      changes.push({
        coin,
        direction: cur.size > pr.size ? "加仓" : "减仓",
        diff: Math.abs(cur.size - pr.size),
        pct: pr.size !== 0 ? Math.abs((cur.size - pr.size) / pr.size) * 100 : 0,
      });
    }
  }
  return { newCoins, closedCoins, changes };
}

// ── 报告生成 ──

export function generateReport(allAnalyses, config) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const timeStr = today.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  let md = `# 交易员监控日报 - ${dateStr}\n\n> 生成时间：${timeStr} | 监控人数：${allAnalyses.length}\n\n---\n\n`;

  // 总览
  md += "## 总览\n\n| # | 交易员 | 近30天盈亏 | 收益率 | 胜率 | 最大回撤 | 资产 | 当前持仓数 |\n|---|--------|------------|--------|------|----------|------|------------|\n";
  allAnalyses.forEach((a, i) => {
    const p = a.profile;
    md += `| ${i + 1} | **${p.nickName}** | ${fmtUSD(p.pnl)} | ${fmtPct(p.pnlRatio)} | ${fmtPct(p.winRate)} | ${fmtPct(p.maxDrawdown)} | ${fmtUSD(p.asset)} | ${a.positions.total} |\n`;
  });

  // 交易活跃度
  md += "\n## 交易活跃度\n\n| 交易员 | 近2天笔数 | 近一周笔数 | 近一月笔数 | 市价单占比 | 交易额(近2天) |\n|--------|:---------:|:---------:|:---------:|:---------:|:----------:|\n";
  allAnalyses.forEach((a) => {
    const total1m = a.trading.m1.buyCount + a.trading.m1.sellCount;
    const marketRatio = total1m > 0 ? (a.trading.m1.marketCount / total1m * 100).toFixed(0) + "%" : "N/A";
    md += `| ${a.profile.nickName} | ${a.trading.d2.buyCount + a.trading.d2.sellCount} | ${a.trading.w1.buyCount + a.trading.w1.sellCount} | ${total1m} | ${marketRatio} | ${fmtUSD(a.trading.d2.totalValue)} |\n`;
  });

  // 风险概览
  md += "\n## 风险概览\n\n| 交易员 | 最大杠杆 | 平均杠杆 | 杠杆趋势 | 最大回撤 | 当前持仓浮盈亏 |\n|--------|:-------:|:-------:|:-------:|:-------:|:-------------:|\n";
  allAnalyses.forEach((a) => {
    md += `| ${a.profile.nickName} | ${a.risk.maxLever}x | ${a.risk.avgLever.toFixed(1)}x | ${a.risk.leverTrend} | ${fmtPct(a.risk.maxDrawdown)} | ${a.positions.totalUpl >= 0 ? "🟢" : "🔴"} ${fmtUSD(a.positions.totalUpl)} |\n`;
  });

  // 每个交易员详细画像
  md += "\n---\n\n";
  for (const a of allAnalyses) {
    md += `## ${a.profile.nickName} 详细画像\n\n`;
    md += `- **ID**: \`${a.profile.authorId}\`\n`;
    md += `- **30天累计盈亏**: ${fmtUSD(a.profile.pnl)} (${fmtPct(a.profile.pnlRatio)})\n`;
    md += `- **30天胜率**: ${fmtPct(a.profile.winRate)}\n`;
    md += `- **最大回撤**: ${fmtPct(a.profile.maxDrawdown)}\n`;
    md += `- **资产管理规模**: ${fmtUSD(a.profile.asset)}\n`;
    md += `- **在榜天数**: ${a.profile.onboardDuration} 天\n\n`;

    if (a.positions.coins.length > 0) {
      md += "### 当前持仓\n\n| 币种 | 方向 | 仓位量 | 开仓均价 | 当前价 | 杠杆 | 名义价值 | 浮盈亏 | 仓位强度 |\n|------|:----:|--------|----------|--------|:----:|----------|--------|:-------:|\n";
      for (const c of a.positions.coins) {
        const dir = c.direction === "long" ? "📈 多" : c.direction === "short" ? "📉 空" : c.direction;
        md += `| ${c.instId} | ${dir} | ${fmtNum(c.size, 4)} | ${fmtNum(c.avgPx)} | ${fmtNum(c.last)} | ${c.lever}x | ${fmtUSD(c.notional)} | ${c.upl >= 0 ? "🟢" : "🔴"} ${fmtUSD(c.upl)} | ${fmtPct(c.intensity)} |\n`;
      }
      md += `\n> 总名义价值: ${fmtUSD(a.positions.totalNotional)} | 总浮盈亏: ${fmtUSD(a.positions.totalUpl)}\n\n`;
    } else {
      md += "### 当前持仓\n\n> 🚫 无持仓\n\n";
    }

    // 币种偏好（基于近一月成交）
    const coinKeys = Object.keys(a.trading.m1.coins);
    if (coinKeys.length > 0) {
      md += "### 币种偏好 (近一月)\n\n| 币种 | 总笔数 | 买入额 | 卖出额 |\n|------|:------:|--------|--------|\n";
      for (const coin of coinKeys.slice(0, 10)) {
        const c = a.trading.m1.coins[coin];
        md += `| ${coin} | ${c.count} | ${fmtUSD(c.buyValue)} | ${fmtUSD(c.sellValue)} |\n`;
      }
      md += "\n";
    }

    // 风险指标
    md += `### 风险指标\n\n| 指标 | 值 |\n|------|----|\n| 最大使用杠杆 | ${a.risk.maxLever}x |\n| 平均杠杆 | ${a.risk.avgLever.toFixed(1)}x |\n| 近期杠杆趋势 | ${a.risk.leverTrend} (近10笔 ${a.risk.avgRecentLever.toFixed(1)}x vs 远10笔 ${a.risk.avgOlderLever.toFixed(1)}x) |\n| 最大回撤 | ${fmtPct(a.risk.maxDrawdown)} |\n\n---\n\n`;
  }

  // 日间对比
  const yesterdayData = loadYesterdayReport();
  if (yesterdayData) {
    md += "## 持仓变化 (vs 昨日)\n\n";
    for (const a of allAnalyses) {
      const diff = compareDayOverDay(a, yesterdayData);
      if (diff) {
        md += `### ${a.profile.nickName}\n\n`;
        if (diff.newCoins.length) md += `- 🆕 **新增币种**: ${diff.newCoins.join(", ")}\n`;
        if (diff.closedCoins.length) md += `- ❌ **了结币种**: ${diff.closedCoins.join(", ")}\n`;
        if (diff.changes.length) {
          for (const ch of diff.changes) md += `- 🔄 **${ch.coin}**: ${ch.direction} ${fmtNum(ch.diff, 4)} (${ch.pct.toFixed(1)}%)\n`;
        }
        if (!diff.newCoins.length && !diff.closedCoins.length && !diff.changes.length) md += `- 无变化\n`;
        md += "\n";
      }
    }
  }

  const rawForTomorrow = {
    date: dateStr,
    traders: allAnalyses.map((a) => ({
      authorId: a.profile.authorId,
      nickName: a.profile.nickName,
      positions: { coins: a.positions.coins.map((c) => ({ instId: c.instId, direction: c.direction, size: c.size })) },
    })),
  };

  return { markdown: md, raw: rawForTomorrow };
}

// ── 飞书通知 ──

async function sendFeishu(allAnalyses, dateStr, config) {
  const webhookUrl = config.feishu?.webhookUrl;
  if (!webhookUrl) { console.log("[飞书] 未配置 webhookUrl，跳过推送"); return; }

  const sorted = [...allAnalyses].sort((a, b) => b.profile.pnl - a.profile.pnl);
  const top3 = sorted.slice(0, 3);

  const card = {
    msg_type: "interactive",
    card: {
      header: { title: { tag: "plain_text", content: `📊 交易员监控日报 - ${dateStr}` }, template: "blue" },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `**监控人数**：${allAnalyses.length} 人\n\n**🏆 近一月 Top 3 交易员**：\n\n${top3.map((a, i) => `${["🥇", "🥈", "🥉"][i]} **${a.profile.nickName}** — 盈利 ${fmtUSD(a.profile.pnl)} | 胜率 ${fmtPct(a.profile.winRate)} | 当前${a.positions.total}笔持仓`).join("\n\n")}`,
          },
        },
        ...top3.flatMap((a) => {
          if (a.positions.coins.length === 0) return [];
          return [{
            tag: "div",
            text: {
              tag: "lark_md",
              content: `**${a.profile.nickName} 当前持仓**：\n${a.positions.coins.map((c) => `${c.direction === "short" ? "📉" : "📈"} ${c.instId} ${c.direction} ${fmtNum(c.size, 2)} @ ${fmtNum(c.avgPx)} | ${c.lever}x | 浮${c.upl >= 0 ? "盈" : "亏"} ${fmtUSD(c.upl)}`).join("\n")}`,
            },
          }];
        }),
        { tag: "hr" },
        { tag: "note", elements: [{ tag: "plain_text", content: `报告文件：trader-report-${dateStr}.md | 下次推送：每天 08:00 / 20:00` }] },
      ],
    },
  };

  try {
    const resp = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
    console.log("[飞书] 推送结果:", resp.status, await resp.text());
  } catch (err) {
    console.error("[飞书] 推送失败:", err.message);
  }
}

// ── 清理 ──

export function cleanOldReports(keepDays) {
  if (!fs.existsSync(REPORT_DIR)) return;
  const cutoff = Date.now() - keepDays * 86400000;
  for (const f of fs.readdirSync(REPORT_DIR)) {
    const fp = path.join(REPORT_DIR, f);
    if (fs.statSync(fp).mtimeMs < cutoff) {
      fs.unlinkSync(fp);
      console.log(`  🗑️ 已清理过期报告: ${f}`);
    }
  }
}

// ── 主流程 ──

export async function runMonitor(options = {}) {
  const { noFeishu = false, noSave = false } = options;
  const logs = [];

  function log(msg) {
    console.log(msg);
    logs.push(msg);
  }

  log("=".repeat(50));
  log(`  交易员监控任务开始: ${new Date().toLocaleString("zh-CN")}`);
  log("=".repeat(50));

  const config = loadConfig();
  const traders = config.traders || [];
  if (!traders.length) throw new Error("config.json 中未配置任何交易员");

  // Phase 1: 批量获取 leaderboard profiles
  log(`\n📡 获取 ${traders.length} 位交易员 leaderboard 数据...`);
  const allAuthorIds = traders.map((t) => t.authorId);
  const profileMap = await fetchAllProfiles(allAuthorIds);
  log(`  Profile 获取完成 (${profileMap.size} 人)`);

  // Phase 2: 逐个获取详情（profile + 持仓 + 成交）
  log(`\n📡 获取交易员详情 (profile + 持仓 + 成交)...`);
  const allRaw = [];
  for (const t of traders) {
    const start = Date.now();
    const detail = await fetchTraderDetail(t.authorId);
    // leaderboard profile 优先，detail profile 作为 fallback
    const profile = profileMap.get(t.authorId) || detail.profile;
    allRaw.push({ ...detail, profile });
    log(`  [${t.nickName}] ${detail.positions.length}个持仓, ${detail.trades.length}笔成交 (${Date.now() - start}ms)`);
  }

  // 分析
  log(`\n📊 策略分析中...`);
  const allAnalyses = allRaw.map(analyzeTrader);

  // 报告
  const dateStr = new Date().toISOString().slice(0, 10);
  const { markdown, raw } = generateReport(allAnalyses, config);

  // 写入 MySQL
  if (!noSave) {
    log(`💾 写入 MySQL...`);
    for (const analysis of allAnalyses) {
      try {
        await storage.saveAnalysis(analysis, dateStr);
      } catch (err) {
        log(`  [MySQL] ${analysis.profile.nickName} 写入失败: ${err.message}`);
      }
    }
    log(`  写入完成`);
  }

  // 写报告文件
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, `trader-report-${dateStr}.md`), markdown, "utf-8");
  fs.writeFileSync(path.join(REPORT_DIR, `trader-report-${dateStr}.json`), JSON.stringify(raw, null, 2), "utf-8");
  log(`📝 报告已保存: reports/trader-report-${dateStr}.md`);

  // 飞书
  if (!noFeishu) await sendFeishu(allAnalyses, dateStr, config);

  // 清理
  cleanOldReports(config.report?.keepDays || 30);

  log(`\n✅ 监控任务完成`);

  return { success: true, dateStr, logs, analyses: allAnalyses };
}

// CLI 直接调用入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const noFeishu = process.argv.includes("--no-feishu");
  runMonitor({ noFeishu }).catch((err) => {
    console.error("任务执行失败:", err);
    process.exit(1);
  });
}

import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { analyzeNews } from "../services/llm.js";

const router = Router();
const execP = promisify(exec);

function escapeArg(arg) {
  if (/^[a-zA-Z0-9_,.:/@%+=\-]+$/.test(String(arg))) return String(arg);
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}

async function runOkx(args) {
  const cmd = "okx " + args.map(escapeArg).join(" ");
  console.log("[news]", cmd);
  const { stdout } = await execP(cmd, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
  return JSON.parse(stdout);
}

// 从源页面抓取中文标题
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
    if (!resp.ok) {
      console.log(`  [cnTitle] HTTP ${resp.status} for ${sourceUrl.slice(0, 60)}`);
      return null;
    }
    const html = await resp.text();

    // 尝试从 <title> 提取
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const raw = titleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
      // 过滤掉全英文标题（长度>10且不含中文）
      if (/[\u4e00-\u9fff]/.test(raw)) {
        console.log(`  [cnTitle] ✓ ${raw.slice(0, 60)}`);
        return raw;
      }
    }

    // 尝试 og:title
    const ogMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogMatch && /[\u4e00-\u9fff]/.test(ogMatch[1])) {
      console.log(`  [cnTitle] og:title ✓ ${ogMatch[1].slice(0, 60)}`);
      return ogMatch[1];
    }

    console.log(`  [cnTitle] ✗ no Chinese title found in ${sourceUrl.slice(0, 60)}`);
    return null;
  } catch (err) {
    console.log(`  [cnTitle] err: ${err.message} for ${sourceUrl.slice(0, 60)}`);
    return null;
  }
}

// GET /api/news — 获取最新资讯（中文）
router.get("/", async (req, res) => {
  try {
    const { type = "important", limit = "20" } = req.query;
    const action = type === "latest" ? "latest" : "important";

    const result = await runOkx([
      "news", action,
      "--lang", "zh-CN",
      "--limit", limit,
      "--json",
    ]);

    const items = result.details || [];

    // 并行抓取中文标题（限前15条，每条约1-3秒）
    const enriched = await Promise.all(
      items.slice(0, 15).map(async (item, i) => {
        if (item.sourceUrl) {
          const cnTitle = await fetchChineseTitle(item.sourceUrl);
          if (cnTitle) {
            // 避免重复如 "标题 - OKX" 或 "标题_Odaily"
            item.cnTitle = cnTitle.replace(/\s*[-_|]\s*(OKX|Odaily|PANews|BlockBeats|Foresight).*$/i, "");
          }
        }
        return item;
      })
    );

    res.json({ code: 0, data: { details: enriched } });
  } catch (err) {
    console.error("[news] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/news/analyze — AI 分析资讯
router.get("/analyze", async (req, res) => {
  try {
    const { type = "important", limit = "15" } = req.query;

    const result = await runOkx([
      "news", type === "latest" ? "latest" : "important",
      "--lang", "zh-CN",
      "--limit", limit,
      "--json",
    ]);

    const items = result.details || [];

    // 抓中文标题
    const enriched = await Promise.all(
      items.map(async (item) => {
        if (item.sourceUrl) {
          const cnTitle = await fetchChineseTitle(item.sourceUrl);
          if (cnTitle) {
            item.cnTitle = cnTitle.replace(/\s*[-_|]\s*(OKX|Odaily|PANews|BlockBeats|Foresight).*$/i, "");
          }
        }
        return item;
      })
    );

    // 调用 DeepSeek 分析
    console.log("[analyze] 调用 DeepSeek 分析中...");
    const analysis = await analyzeNews(enriched);
    console.log("[analyze] ✓ 分析完成");

    res.json({ code: 0, data: { analysis, news: enriched } });
  } catch (err) {
    console.error("[analyze] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// ── AI资讯专栏（代理 aihot.virxact.com）──

const AIHOT_BASE = "https://aihot.virxact.com";

// GET /api/news/ai/items — AI资讯列表
router.get("/ai/items", async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.category) params.set("category", req.query.category);
    if (req.query.cursor) params.set("cursor", req.query.cursor);
    params.set("take", req.query.take || "30");
    params.set("mode", "all");

    const url = `${AIHOT_BASE}/api/public/items?${params}`;
    console.log("[ai-news]", url);
    const resp = await fetch(url);
    const data = await resp.json();

    res.json({ code: 0, data });
  } catch (err) {
    console.error("[ai-news] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/news/ai/daily — 最新AI日报
router.get("/ai/daily", async (req, res) => {
  try {
    const url = `${AIHOT_BASE}/api/public/daily`;
    console.log("[ai-daily]", url);
    const resp = await fetch(url);
    if (resp.status === 404) return res.json({ code: 0, data: null });
    const data = await resp.json();

    res.json({ code: 0, data });
  } catch (err) {
    console.error("[ai-daily] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/news/ai/daily/:date — 指定日期AI日报
router.get("/ai/daily/:date", async (req, res) => {
  try {
    const url = `${AIHOT_BASE}/api/public/daily/${req.params.date}`;
    console.log("[ai-daily]", url);
    const resp = await fetch(url);
    if (resp.status === 404) return res.json({ code: 0, data: null });
    const data = await resp.json();

    res.json({ code: 0, data });
  } catch (err) {
    console.error("[ai-daily] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

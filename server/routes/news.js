import { Router } from "express";
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

export default router;

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

// GET /api/news — 获取最新资讯
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

    res.json({ code: 0, data: result });
  } catch (err) {
    console.error("[news] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

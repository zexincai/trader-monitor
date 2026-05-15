import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { getTraders, getTraderById, getAvailableDates } from "../services/storage.js";

const router = Router();
const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// 安全执行 okx CLI 命令
async function runOkx(args) {
  const safeArgs = args.map(String);
  console.log("[okx]", ["okx", ...safeArgs].join(" "));
  const { stdout } = await execFileP("okx", safeArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

// GET /api/traders — 交易员列表
router.get("/", async (_req, res) => {
  try {
    const traders = await getTraders();
    res.json({ code: 0, data: traders });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/traders/discover — 发现交易员（牛人榜筛选）
router.get("/discover", async (req, res) => {
  try {
    const {
      winRatio, maxRetreat, period = "30",
      sortType = "pnl", limit = "20", after,
    } = req.query;

    const args = ["smartmoney", "traders-by-filter", "--period", period, "--limit", limit, "--sortBy", sortType, "--json"];

    if (winRatio) args.push("--minWinRate", winRatio);
    if (maxRetreat) args.push("--maxDrawdown", maxRetreat);
    if (after) args.push("--after", after);

    const result = await runOkx(args);
    const data = result?.data;
    const list = Array.isArray(data) ? data : (data?.data || []);

    // 标记已监控
    const config = readConfig();
    const monitoredIds = new Set((config.traders || []).map((t) => t.authorId));
    const enriched = list.map((t) => ({
      ...t,
      monitored: monitoredIds.has(t.authorId),
    }));

    res.json({ code: 0, data: enriched });
  } catch (err) {
    console.error("[discover] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/traders/search — 按 authorId 查找交易员
router.get("/search", async (req, res) => {
  try {
    const { authorId } = req.query;
    if (!authorId) return res.status(400).json({ code: -1, msg: "authorId required" });

    const result = await runOkx(["smartmoney", "performance-by-trader", "--authorIds", authorId, "--json"]);
    const list = result?.data || [];

    const config = readConfig();
    const monitoredIds = new Set((config.traders || []).map((t) => t.authorId));
    const enriched = list.map((t) => ({
      ...t,
      monitored: monitoredIds.has(t.authorId),
    }));

    res.json({ code: 0, data: enriched });
  } catch (err) {
    console.error("[search] 错误:", err.message);
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// POST /api/traders/add — 添加交易员到监控列表
router.post("/add", (req, res) => {
  try {
    const { authorId, nickName, note = "" } = req.body;
    if (!authorId) return res.status(400).json({ code: -1, msg: "authorId required" });

    const config = readConfig();
    const traders = config.traders || [];

    if (traders.some((t) => t.authorId === authorId)) {
      return res.json({ code: 0, msg: "已在监控列表中", data: config.traders });
    }

    traders.push({ authorId, nickName: nickName || "Unknown", note });
    config.traders = traders;
    writeConfig(config);

    res.json({ code: 0, msg: "添加成功", data: config.traders });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// DELETE /api/traders/:id — 从监控列表移除交易员
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const config = readConfig();
    config.traders = (config.traders || []).filter((t) => t.authorId !== id);
    writeConfig(config);
    res.json({ code: 0, msg: "已移除", data: config.traders });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/traders/:id — 交易员详情（需放在最后，避免和 /discover /search /add 冲突）
router.get("/:id", async (req, res) => {
  try {
    const trader = await getTraderById(Number(req.params.id));
    if (!trader) {
      return res.status(404).json({ code: -1, msg: "交易员不存在" });
    }
    const dates = await getAvailableDates(Number(req.params.id));
    res.json({ code: 0, data: { ...trader, availableDates: dates.map((d) => d.snapshot_date) } });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

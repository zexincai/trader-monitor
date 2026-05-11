import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getMonitorStatus, resetBaseline, checkOnce } from "../services/token-monitor.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// GET /api/tokens — 获取监控代币列表
router.get("/", (_req, res) => {
  try {
    const config = readConfig();
    const tokens = config.tokens || [];
    const status = getMonitorStatus();
    // 合并基线价和当前价到代币列表
    const enriched = tokens.map((t) => ({
      ...t,
      baseline: status.baselines[t.instId] ?? null,
      currentPrice: status.currentPrices[t.instId] ?? null,
    }));
    res.json({
      code: 0,
      data: {
        tokens: enriched,
        config: config.tokenMonitor || {},
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/tokens/status — 监控运行状态
router.get("/status", (_req, res) => {
  try {
    const status = getMonitorStatus();
    const config = readConfig();
    res.json({
      code: 0,
      data: {
        ...status,
        tokenCount: (config.tokens || []).length,
        config: config.tokenMonitor || {},
        schedule: config.schedule || {},
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// POST /api/tokens — 添加代币
router.post("/", (req, res) => {
  try {
    const { instId, label } = req.body;
    if (!instId) return res.status(400).json({ code: -1, msg: "instId required" });

    const config = readConfig();
    const tokens = config.tokens || [];

    if (tokens.some((t) => t.instId === instId)) {
      return res.json({ code: 0, msg: "已在监控列表中", data: tokens });
    }

    tokens.push({ instId, label: label || instId });
    config.tokens = tokens;
    writeConfig(config);

    // 重置该代币基线，下次检查时会重新建立
    resetBaseline(instId);

    res.json({ code: 0, msg: "添加成功", data: tokens });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// DELETE /api/tokens/:instId — 删除代币
router.delete("/:instId", (req, res) => {
  try {
    const { instId } = req.params;
    const config = readConfig();
    config.tokens = (config.tokens || []).filter((t) => t.instId !== instId);
    writeConfig(config);
    resetBaseline(instId);
    res.json({ code: 0, msg: "已移除", data: config.tokens });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// POST /api/tokens/run — 手动触发一次价格检查
router.post("/run", async (req, res) => {
  try {
    const config = readConfig();
    const result = await checkOnce(config);
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

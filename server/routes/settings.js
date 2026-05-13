import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

function mask(s) {
  if (!s) return "";
  if (s.length <= 6) return "***";
  return s.slice(0, 3) + "***" + s.slice(-3);
}

// GET /api/settings — 读取全部配置
router.get("/", (_req, res) => {
  try {
    const config = readConfig();
    res.json({
      code: 0,
      data: {
        feishu: {
          webhookUrl: config.feishu?.webhookUrl || "",
          secret: mask(config.feishu?.secret),
        },
        schedule: config.schedule || { cron: "0 8,20 * * *", timezone: "Asia/Shanghai" },
        tokenMonitor: config.tokenMonitor || { intervalMs: 60000, alertPct: 4, enabled: true },
        deepseek: {
          apiKey: mask(config.deepseek?.apiKey),
          model: config.deepseek?.model || "deepseek-chat",
          temperature: config.deepseek?.temperature ?? 0.3,
          maxTokens: config.deepseek?.maxTokens ?? 2000,
        },
        report: config.report || { outputDir: "./reports", keepDays: 30 },
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// PUT /api/settings — 按分组更新配置
router.put("/", (req, res) => {
  try {
    const { section, data } = req.body;
    if (!section || !data) {
      return res.status(400).json({ code: -1, msg: "section and data are required" });
    }

    const config = readConfig();

    switch (section) {
      case "feishu": {
        config.feishu = config.feishu || {};
        if (data.webhookUrl !== undefined) {
          // 如果传入的不是脱敏值才更新
          if (data.webhookUrl && !data.webhookUrl.includes("***")) {
            config.feishu.webhookUrl = data.webhookUrl;
          }
        }
        if (data.secret !== undefined) {
          if (data.secret && !data.secret.includes("***")) {
            config.feishu.secret = data.secret;
          }
        }
        break;
      }
      case "schedule": {
        config.schedule = config.schedule || {};
        if (data.cron !== undefined) {
          const parts = String(data.cron).trim().split(/\s+/);
          if (parts.length !== 5) {
            return res.status(400).json({ code: -1, msg: "cron 格式错误，需要5个字段" });
          }
          config.schedule.cron = data.cron;
        }
        if (data.timezone !== undefined) {
          config.schedule.timezone = data.timezone;
        }
        break;
      }
      case "tokenMonitor": {
        config.tokenMonitor = config.tokenMonitor || {};
        if (data.intervalMs !== undefined) {
          const v = Number(data.intervalMs);
          if (v < 5000 || v > 3600000) {
            return res.status(400).json({ code: -1, msg: "intervalMs 范围: 5000 ~ 3600000 (5秒~1小时)" });
          }
          config.tokenMonitor.intervalMs = v;
        }
        if (data.alertPct !== undefined) {
          const v = Number(data.alertPct);
          if (v < 0.1 || v > 100) {
            return res.status(400).json({ code: -1, msg: "alertPct 范围: 0.1 ~ 100" });
          }
          config.tokenMonitor.alertPct = v;
        }
        if (data.enabled !== undefined) {
          config.tokenMonitor.enabled = Boolean(data.enabled);
        }
        break;
      }
      case "deepseek": {
        config.deepseek = config.deepseek || {};
        if (data.apiKey !== undefined) {
          if (data.apiKey && !data.apiKey.includes("***")) {
            config.deepseek.apiKey = data.apiKey;
          }
        }
        if (data.model !== undefined) {
          config.deepseek.model = data.model;
        }
        if (data.temperature !== undefined) {
          config.deepseek.temperature = Number(data.temperature);
        }
        if (data.maxTokens !== undefined) {
          config.deepseek.maxTokens = Number(data.maxTokens);
        }
        break;
      }
      case "report": {
        config.report = config.report || {};
        if (data.outputDir !== undefined) {
          config.report.outputDir = data.outputDir;
        }
        if (data.keepDays !== undefined) {
          config.report.keepDays = Number(data.keepDays);
        }
        break;
      }
      default:
        return res.status(400).json({ code: -1, msg: `未知配置分组: ${section}` });
    }

    writeConfig(config);
    res.json({ code: 0, msg: "保存成功" });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// POST /api/settings/test-feishu — 发送测试消息到飞书
router.post("/test-feishu", async (req, res) => {
  try {
    const config = readConfig();
    const { webhookUrl, secret } = config.feishu || {};

    if (!webhookUrl) {
      return res.status(400).json({ code: -1, msg: "飞书 webhookUrl 未配置" });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    let sign = "";
    if (secret) {
      const crypto = await import("crypto");
      const hmac = crypto.createHmac("sha256", secret + "\n" + timestamp);
      sign = hmac.digest("base64");
    }

    const body = {
      timestamp: String(timestamp),
      sign,
      msg_type: "interactive",
      card: {
        header: {
          title: { content: "🧪 测试消息", tag: "plain_text" },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: { content: "这是一条来自 Crypto监控系统 的测试消息，配置正确 ✅", tag: "lark_md" },
          },
        ],
      },
    };

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await resp.json();
    if (result.code === 0 || result.StatusCode === 0) {
      res.json({ code: 0, msg: "测试消息发送成功" });
    } else {
      res.json({ code: -1, msg: `发送失败: ${JSON.stringify(result)}` });
    }
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

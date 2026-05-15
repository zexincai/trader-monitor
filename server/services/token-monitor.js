/**
 * 代币价格监控服务
 *
 * 每分钟拉取 OKX 行情，涨幅超过阈值时通过飞书告警。
 * 告警后重置基准价，继续监控。
 */
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

// 基准价缓存：instId → 价格
const baselineMap = new Map();

// 监控状态
let lastCheckTime = null;
let currentPrices = {};

// ── 工具函数 ──

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { tokens: [], tokenMonitor: {} };
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

async function runOkx(args) {
  const safeArgs = args.map(String);
  try {
    const { stdout } = await execFileP("okx", safeArgs, { timeout: 30000, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (err) {
    console.error(`[token-monitor] okx 调用失败:`, err.message.trim());
    return null;
  }
}

// ── 价格采集 ──

async function fetchPrice(instId) {
  const result = await runOkx(["market", "ticker", "--instId", instId, "--json"]);
  const items = result?.data || result;
  if (Array.isArray(items) && items.length > 0) {
    return Number(items[0].last);
  }
  return null;
}

// ── 飞书告警 ──

async function sendAlert(instId, label, currentPrice, baselinePrice, pct, config) {
  const webhookUrl = config.feishu?.webhookUrl;
  if (!webhookUrl) {
    console.log("[token-monitor] 飞书 webhookUrl 未配置，跳过告警");
    return;
  }

  const timeStr = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const card = {
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: "🚨 代币涨幅告警" },
        template: "red",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: [
              `**代币**：${label || instId}`,
              `**交易对**：${instId}`,
              `**当前价格**：${currentPrice.toFixed(4)}`,
              `**基准价格**：${baselinePrice.toFixed(4)}`,
              `**涨幅**：${pct.toFixed(2)}%`,
              `**触发时间**：${timeStr}`,
            ].join("\n"),
          },
        },
        { tag: "hr" },
        {
          tag: "note",
          elements: [
            {
              tag: "plain_text",
              content: `基准价已重置为 ${currentPrice.toFixed(4)}，继续监控中`,
            },
          ],
        },
      ],
    },
  };

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    console.log(`[token-monitor] 飞书告警已发送: ${label || instId} +${pct.toFixed(2)}% → ${resp.status}`);
  } catch (err) {
    console.error("[token-monitor] 飞书告警发送失败:", err.message);
  }
}

// ── 单次检查 ──

export async function checkOnce(config) {
  const tokens = config.tokens || [];
  const alertPct = config.tokenMonitor?.alertPct ?? 4;

  if (!tokens.length) return;

  const results = [];
  const alerts = [];

  for (const token of tokens) {
    const { instId, label } = token;
    if (!instId) continue;

    const price = await fetchPrice(instId);
    if (price === null) {
      console.log(`[token-monitor] ${instId} 价格获取失败`);
      continue;
    }

    currentPrices[instId] = price;
    const baseline = baselineMap.get(instId);

    if (baseline === undefined) {
      // 首次设置基准价
      baselineMap.set(instId, price);
      console.log(`[token-monitor] ${instId} 初始基准价: ${price}`);
      results.push({ instId, price, baseline: price, pct: 0, isNew: true });
    } else {
      const pct = ((price - baseline) / baseline) * 100;
      results.push({ instId, price, baseline, pct, isNew: false });

      if (pct >= alertPct) {
        // 触发告警 → 重置基准价
        baselineMap.set(instId, price);
        alerts.push({ instId, label: label || instId, price, baseline, pct });
        console.log(`[token-monitor] 🚨 ${instId} 涨幅 ${pct.toFixed(2)}% 触发告警 (基准:${baseline} → 当前:${price})`);
      } else {
        console.log(`[token-monitor] ${instId} 价格:${price} 基准:${baseline} 涨幅:${pct.toFixed(2)}%`);
      }
    }
  }

  // 发送飞书告警
  for (const alert of alerts) {
    await sendAlert(alert.instId, alert.label, alert.price, alert.baseline, alert.pct, config);
  }

  lastCheckTime = new Date().toISOString();
  return { results, alerts };
}

// ── 调度循环 ──

let monitorTimer = null;

export function startTokenMonitor() {
  const config = loadConfig();
  if (!config.tokenMonitor?.enabled) {
    console.log("[token-monitor] 代币监控未启用");
    return;
  }

  const intervalMs = config.tokenMonitor?.intervalMs || 60000;
  console.log(`[token-monitor] 代币价格监控已启动 (间隔:${intervalMs / 1000}s, 阈值:${config.tokenMonitor?.alertPct ?? 4}%)`);

  // 启动时立即执行一次以建立基准价
  checkOnce(config).catch((err) => console.error("[token-monitor] 初始检查失败:", err.message));

  // 定时循环
  monitorTimer = setInterval(() => {
    const cfg = loadConfig();
    checkOnce(cfg).catch((err) => console.error("[token-monitor] 检查失败:", err.message));
  }, intervalMs);
}

export function stopTokenMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
    console.log("[token-monitor] 监控已停止");
  }
}

// 暴露状态供 API 查询
export function getMonitorStatus() {
  return {
    enabled: true,
    lastCheckTime,
    baselines: Object.fromEntries(baselineMap),
    currentPrices: { ...currentPrices },
  };
}

// 重置某个代币的基准价
export function resetBaseline(instId) {
  baselineMap.delete(instId);
  console.log(`[token-monitor] ${instId} 基准价已重置`);
}

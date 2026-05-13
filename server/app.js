import express from "express";
import cors from "cors";
import config from "./config.js";
import tradersRouter from "./routes/traders.js";
import snapshotsRouter from "./routes/snapshots.js";
import positionsRouter from "./routes/positions.js";
import newsRouter from "./routes/news.js";
import tokensRouter from "./routes/tokens.js";
import settingsRouter from "./routes/settings.js";
import dailyReportRouter from "./routes/daily-report.js";
import { runMonitor } from "./services/monitor.js";
import { startTokenMonitor } from "./services/token-monitor.js";

const app = express();

app.use(cors());
app.use(express.json());

// API 路由
app.use("/api/traders", tradersRouter);
app.use("/api/snapshots", snapshotsRouter);
app.use("/api/positions", positionsRouter);
app.use("/api/news", newsRouter);
app.use("/api/tokens", tokensRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/daily-report", dailyReportRouter);

// 健康检查
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 手动触发监控
app.post("/api/monitor/run", async (req, res) => {
  try {
    const noFeishu = req.body?.noFeishu ?? req.query?.noFeishu ?? false;
    const result = await runMonitor({ noFeishu });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// 查看最近一次运行日志
let lastRunLogs = [];
app.get("/api/monitor/logs", (_req, res) => {
  res.json({ code: 0, data: lastRunLogs });
});

// 内建定时调度
function parseScheduleTime() {
  const cronStr = config.schedule?.cron || "0 8,20 * * *";
  const parts = cronStr.trim().split(/\s+/);
  const minutes = parts[0].split(",").map(Number);
  const hours = parts[1].split(",").map(Number);
  return { hours, minutes };
}

function calcNextRun(hours, minutes) {
  const now = new Date();
  const candidates = [];
  for (const h of hours) {
    for (const m of minutes) {
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      candidates.push(d);
    }
  }
  return candidates.sort((a, b) => a - b)[0];
}

function startScheduler() {
  const { hours, minutes } = parseScheduleTime();
  const times = hours.map((h) => `${String(h).padStart(2, "0")}:${String(minutes[0] || 0).padStart(2, "0")}`).join(", ");
  console.log(`[scheduler] 定时任务: ${times} (北京时间)`);

  async function loop() {
    const next = calcNextRun(hours, minutes);
    const waitMs = next.getTime() - Date.now();
    console.log(`[scheduler] 下次执行: ${next.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} (${(waitMs / 60000).toFixed(0)} 分钟后)`);

    setTimeout(async () => {
      console.log(`\n[scheduler] 🚀 定时监控触发...`);
      try {
        const result = await runMonitor();
        lastRunLogs = result.logs || [];
      } catch (err) {
        console.error("[scheduler] 任务失败:", err.message);
        lastRunLogs = [`错误: ${err.message}`];
      }
      loop(); // 继续下一轮
    }, Math.min(waitMs, 3600000)); // 最多等 1 小时就重新检查
  }

  loop();
}

app.listen(config.server.port, () => {
  console.log(`[server] 交易员监控 API 已启动 → http://localhost:${config.server.port}`);
  console.log(`[server] API 端点:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/traders`);
  console.log(`  GET  /api/traders/:id`);
  console.log(`  GET  /api/snapshots/latest`);
  console.log(`  GET  /api/snapshots?traderId=&days=30`);
  console.log(`  GET  /api/positions/latest`);
  console.log(`  GET  /api/positions?traderId=&date=`);
  console.log(`  GET  /api/positions/preferences?traderId=`);
  console.log(`  GET  /api/news?type=important&limit=20`);
  console.log(`  GET  /api/tokens`);
  console.log(`  POST /api/tokens`);
  console.log(`  DELETE /api/tokens/:instId`);
  console.log(`  GET  /api/tokens/status`);
  console.log(`  POST /api/tokens/run`);
  console.log(`  POST /api/monitor/run`);
  console.log(`  GET  /api/monitor/logs`);
  console.log(`  GET  /api/settings`);
  console.log(`  PUT  /api/settings`);
  console.log(`  POST /api/settings/test-feishu`);
  console.log(`  GET  /api/daily-report`);
  console.log("");

  startScheduler();
  startTokenMonitor();
});

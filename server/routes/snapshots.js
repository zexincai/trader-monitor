import { Router } from "express";
import { getLatestSnapshots, getSnapshotsByTrader } from "../services/storage.js";

const router = Router();

// GET /api/snapshots/latest — 最新一期所有交易员快照
router.get("/latest", async (_req, res) => {
  try {
    const data = await getLatestSnapshots();
    res.json({ code: 0, data });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/snapshots?traderId=&days=30 — 某交易员历史快照
router.get("/", async (req, res) => {
  try {
    const { traderId, days } = req.query;
    if (!traderId) {
      return res.status(400).json({ code: -1, msg: "traderId is required" });
    }
    const data = await getSnapshotsByTrader(Number(traderId), Number(days) || 30);
    res.json({ code: 0, data });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

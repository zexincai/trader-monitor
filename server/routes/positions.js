import { Router } from "express";
import { getLatestPositions, getPositionsByTrader, getPreferencesByTrader } from "../services/storage.js";

const router = Router();

// GET /api/positions/latest — 最新所有持仓
router.get("/latest", async (_req, res) => {
  try {
    const data = await getLatestPositions();
    res.json({ code: 0, data });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/positions?traderId=&date= — 某交易员持仓
router.get("/", async (req, res) => {
  try {
    const { traderId, date } = req.query;
    if (!traderId) {
      return res.status(400).json({ code: -1, msg: "traderId is required" });
    }
    const data = await getPositionsByTrader(Number(traderId), date || null);
    res.json({ code: 0, data });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// GET /api/positions/preferences?traderId= — 币种偏好
router.get("/preferences", async (req, res) => {
  try {
    const { traderId } = req.query;
    if (!traderId) {
      return res.status(400).json({ code: -1, msg: "traderId is required" });
    }
    const data = await getPreferencesByTrader(Number(traderId));
    res.json({ code: 0, data });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

export default router;

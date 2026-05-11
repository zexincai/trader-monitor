import { query } from "../db/connection.js";

// ── 交易员主表 ──

export async function ensureTrader(authorId, nickName, note = "") {
  const rows = await query(
    `INSERT INTO traders (author_id, nick_name, note)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE nick_name = VALUES(nick_name), note = VALUES(note)`,
    [authorId, nickName, note]
  );
  // 获取 trader_id（新增或已存在）
  const [trader] = await query(
    "SELECT id FROM traders WHERE author_id = ?",
    [authorId]
  );
  return trader.id;
}

// ── 每日快照 ──

export async function saveDailySnapshot(traderId, analysis, dateStr) {
  const { profile, positions, trading, pnl, risk } = analysis;
  const total1m = trading.m1.buyCount + trading.m1.sellCount;
  const marketRatio = total1m > 0 ? trading.m1.marketCount / total1m : 0;

  await query(
    `INSERT INTO daily_snapshots
       (trader_id, snapshot_date,
        pnl_30d, pnl_ratio, win_ratio, max_drawdown, asset, onboard_days, position_count,
        pnl_2d, win_rate_2d, trade_count_2d,
        pnl_1w, win_rate_1w, trade_count_1w,
        pnl_1m, win_rate_1m, trade_count_1m,
        max_lever, avg_lever, lever_trend,
        market_order_ratio, volume_24h)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       pnl_30d = VALUES(pnl_30d), pnl_ratio = VALUES(pnl_ratio),
       win_ratio = VALUES(win_ratio), max_drawdown = VALUES(max_drawdown),
       asset = VALUES(asset), onboard_days = VALUES(onboard_days),
       position_count = VALUES(position_count),
       pnl_2d = VALUES(pnl_2d), win_rate_2d = VALUES(win_rate_2d),
       trade_count_2d = VALUES(trade_count_2d),
       pnl_1w = VALUES(pnl_1w), win_rate_1w = VALUES(win_rate_1w),
       trade_count_1w = VALUES(trade_count_1w),
       pnl_1m = VALUES(pnl_1m), win_rate_1m = VALUES(win_rate_1m),
       trade_count_1m = VALUES(trade_count_1m),
       max_lever = VALUES(max_lever), avg_lever = VALUES(avg_lever),
       lever_trend = VALUES(lever_trend),
       market_order_ratio = VALUES(market_order_ratio),
       volume_24h = VALUES(volume_24h)`,
    [
      traderId, dateStr,
      profile.pnl, profile.pnlRatio, profile.winRate,
      profile.maxDrawdown, profile.asset, profile.onboardDuration,
      positions.total,
      pnl.d2.totalPnl, pnl.d2.winRate, pnl.d2.count,
      pnl.w1.totalPnl, pnl.w1.winRate, pnl.w1.count,
      pnl.m1.totalPnl, pnl.m1.winRate, pnl.m1.count,
      risk.maxLever, risk.avgLever, risk.leverTrend,
      marketRatio, trading.d2.totalValue,
    ]
  );

  const [snap] = await query(
    "SELECT id FROM daily_snapshots WHERE trader_id = ? AND snapshot_date = ?",
    [traderId, dateStr]
  );
  return snap.id;
}

// ── 持仓快照 ──

export async function savePositionSnapshots(snapshotId, traderId, positions, dateStr) {
  // 先删除该快照下的旧持仓
  await query("DELETE FROM position_snapshots WHERE snapshot_id = ?", [snapshotId]);

  if (!positions.coins || positions.coins.length === 0) return;

  const values = positions.coins.map((c) => [
    snapshotId, traderId, c.instId,
    c.direction, c.size, c.avgPx, c.last,
    c.lever, c.notional, c.upl, c.intensity, dateStr,
  ]);

  await query(
    `INSERT INTO position_snapshots
       (snapshot_id, trader_id, inst_id, direction, size, avg_px, last_px,
        lever, notional_usd, upl, intensity, snapshot_date)
     VALUES ?`,
    [values]
  );
}

// ── 币种偏好 ──

export async function saveCoinPreferences(snapshotId, traderId, trading, pnlAnalysis, dateStr) {
  await query("DELETE FROM coin_preferences WHERE snapshot_id = ?", [snapshotId]);

  const coinMap = trading.m1.coins || {};
  const pnlByCoin = pnlAnalysis.m1.byCoin || {};
  const allCoins = new Set([...Object.keys(coinMap), ...Object.keys(pnlByCoin)]);

  if (allCoins.size === 0) return;

  const values = [];
  for (const coin of allCoins) {
    const trade = coinMap[coin] || { count: 0, buyValue: 0, sellValue: 0 };
    const pnl = pnlByCoin[coin] || { pnl: null, wins: 0, losses: 0 };
    values.push([
      snapshotId, traderId, coin,
      trade.count, trade.buyValue, trade.sellValue,
      pnl.pnl, pnl.wins, pnl.losses, dateStr,
    ]);
  }

  await query(
    `INSERT INTO coin_preferences
       (snapshot_id, trader_id, inst_id, trade_count, buy_value, sell_value,
        pnl, wins, losses, snapshot_date)
     VALUES ?`,
    [values]
  );
}

// ── 存入一条完整的交易员分析记录 ──

export async function saveAnalysis(analysis, dateStr) {
  const { profile, positions, trading, pnl } = analysis;
  const traderId = await ensureTrader(profile.authorId, profile.nickName);
  const snapshotId = await saveDailySnapshot(traderId, analysis, dateStr);
  await savePositionSnapshots(snapshotId, traderId, positions, dateStr);
  await saveCoinPreferences(snapshotId, traderId, trading, pnl, dateStr);
  return snapshotId;
}

// ── 查询 API ──

export async function getTraders() {
  return query(
    `SELECT t.*,
       (SELECT COUNT(*) FROM daily_snapshots WHERE trader_id = t.id) AS snapshot_count
     FROM traders t ORDER BY t.id`
  );
}

export async function getTraderById(traderId) {
  const [trader] = await query("SELECT * FROM traders WHERE id = ?", [traderId]);
  if (!trader) return null;

  const [latest] = await query(
    "SELECT * FROM daily_snapshots WHERE trader_id = ? ORDER BY snapshot_date DESC LIMIT 1",
    [traderId]
  );
  return { ...trader, latestSnapshot: latest || null };
}

export async function getLatestSnapshots() {
  const rows = await query(
    `SELECT ds.*, t.nick_name, t.author_id
     FROM daily_snapshots ds
     JOIN traders t ON t.id = ds.trader_id
     WHERE ds.snapshot_date = (SELECT MAX(snapshot_date) FROM daily_snapshots)
     ORDER BY ds.pnl_30d DESC`
  );
  return rows;
}

export async function getSnapshotsByTrader(traderId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateStr = since.toISOString().slice(0, 10);

  return query(
    `SELECT * FROM daily_snapshots
     WHERE trader_id = ? AND snapshot_date >= ?
     ORDER BY snapshot_date ASC`,
    [traderId, dateStr]
  );
}

export async function getLatestPositions() {
  const latestDate = await query(
    "SELECT MAX(snapshot_date) AS d FROM position_snapshots"
  );
  if (!latestDate[0]?.d) return [];

  return query(
    `SELECT ps.*, t.nick_name, t.author_id
     FROM position_snapshots ps
     JOIN traders t ON t.id = ps.trader_id
     WHERE ps.snapshot_date = ?
     ORDER BY ps.notional_usd DESC`,
    [latestDate[0].d]
  );
}

export async function getPositionsByTrader(traderId, dateStr) {
  if (dateStr) {
    return query(
      `SELECT ps.*, t.nick_name
       FROM position_snapshots ps
       JOIN traders t ON t.id = ps.trader_id
       WHERE ps.trader_id = ? AND ps.snapshot_date = ?
       ORDER BY ps.notional_usd DESC`,
      [traderId, dateStr]
    );
  }
  // 返回最新一期
  const [latest] = await query(
    `SELECT snapshot_date FROM position_snapshots
     WHERE trader_id = ? ORDER BY snapshot_date DESC LIMIT 1`,
    [traderId]
  );
  if (!latest) return [];
  return getPositionsByTrader(traderId, latest.snapshot_date);
}

export async function getPreferencesByTrader(traderId) {
  const [latest] = await query(
    `SELECT snapshot_date FROM coin_preferences
     WHERE trader_id = ? ORDER BY snapshot_date DESC LIMIT 1`,
    [traderId]
  );
  if (!latest) return [];

  return query(
    `SELECT cp.*, t.nick_name
     FROM coin_preferences cp
     JOIN traders t ON t.id = cp.trader_id
     WHERE cp.trader_id = ? AND cp.snapshot_date = ?
     ORDER BY cp.trade_count DESC`,
    [traderId, latest.snapshot_date]
  );
}

export async function getAvailableDates(traderId) {
  return query(
    `SELECT DISTINCT snapshot_date FROM daily_snapshots
     WHERE trader_id = ? ORDER BY snapshot_date DESC LIMIT 60`,
    [traderId]
  );
}

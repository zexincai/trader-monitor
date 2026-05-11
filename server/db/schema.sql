CREATE DATABASE IF NOT EXISTS trader_monitor
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE trader_monitor;

-- 交易员主表
CREATE TABLE IF NOT EXISTS traders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author_id VARCHAR(64) NOT NULL UNIQUE,
  nick_name VARCHAR(128) NOT NULL,
  note VARCHAR(256) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 每日快照
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trader_id INT NOT NULL,
  snapshot_date DATE NOT NULL,
  pnl_30d DECIMAL(18,2) NOT NULL DEFAULT 0,
  pnl_ratio DECIMAL(8,4) NOT NULL DEFAULT 0,
  win_ratio DECIMAL(8,4) NOT NULL DEFAULT 0,
  max_drawdown DECIMAL(8,4) NOT NULL DEFAULT 0,
  asset DECIMAL(18,2) NOT NULL DEFAULT 0,
  onboard_days INT NOT NULL DEFAULT 0,
  position_count INT NOT NULL DEFAULT 0,
  pnl_2d DECIMAL(18,2) DEFAULT NULL,
  win_rate_2d DECIMAL(8,4) DEFAULT NULL,
  trade_count_2d INT DEFAULT 0,
  pnl_1w DECIMAL(18,2) DEFAULT NULL,
  win_rate_1w DECIMAL(8,4) DEFAULT NULL,
  trade_count_1w INT DEFAULT 0,
  pnl_1m DECIMAL(18,2) DEFAULT NULL,
  win_rate_1m DECIMAL(8,4) DEFAULT NULL,
  trade_count_1m INT DEFAULT 0,
  max_lever DECIMAL(8,2) DEFAULT NULL,
  avg_lever DECIMAL(8,2) DEFAULT NULL,
  lever_trend VARCHAR(16) DEFAULT '',
  market_order_ratio DECIMAL(8,4) DEFAULT NULL,
  volume_24h DECIMAL(18,2) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_trader_date (trader_id, snapshot_date),
  INDEX idx_trader_date (trader_id, snapshot_date),
  FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 持仓快照
CREATE TABLE IF NOT EXISTS position_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snapshot_id INT NOT NULL,
  trader_id INT NOT NULL,
  inst_id VARCHAR(64) NOT NULL,
  direction ENUM('long','short') NOT NULL,
  size DECIMAL(18,6) NOT NULL DEFAULT 0,
  avg_px DECIMAL(18,6) DEFAULT NULL,
  last_px DECIMAL(18,6) DEFAULT NULL,
  lever DECIMAL(8,2) DEFAULT NULL,
  notional_usd DECIMAL(18,2) NOT NULL DEFAULT 0,
  upl DECIMAL(18,2) DEFAULT 0,
  intensity DECIMAL(12,4) DEFAULT NULL,
  snapshot_date DATE NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES daily_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE,
  INDEX idx_snapshot (snapshot_id),
  INDEX idx_trader_date (trader_id, snapshot_date)
) ENGINE=InnoDB;

-- 币种偏好
CREATE TABLE IF NOT EXISTS coin_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snapshot_id INT NOT NULL,
  trader_id INT NOT NULL,
  inst_id VARCHAR(64) NOT NULL,
  trade_count INT NOT NULL DEFAULT 0,
  buy_value DECIMAL(18,2) NOT NULL DEFAULT 0,
  sell_value DECIMAL(18,2) NOT NULL DEFAULT 0,
  pnl DECIMAL(18,2) DEFAULT NULL,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  snapshot_date DATE NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES daily_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE,
  INDEX idx_snapshot (snapshot_id),
  INDEX idx_trader_date (trader_id, snapshot_date)
) ENGINE=InnoDB;

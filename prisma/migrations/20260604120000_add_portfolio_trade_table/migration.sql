CREATE TABLE IF NOT EXISTS `portfolio_trade` (
  `id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `trade_datetime` DATETIME(0) NOT NULL,
  `asset_name` VARCHAR(50) NOT NULL,
  `kind` VARCHAR(20) NOT NULL,
  `qty` DECIMAL(18, 8) NOT NULL,
  `price_usd` DECIMAL(18, 8) NOT NULL,
  `fee_usd` DECIMAL(18, 8) NOT NULL,
  `cash_delta_usd` DECIMAL(18, 8) NOT NULL,
  `note` TEXT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

  INDEX `idx_pt_acc_dt`(`account_id`, `trade_datetime`),
  PRIMARY KEY (`id`)
);

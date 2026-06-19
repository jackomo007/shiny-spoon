CREATE TABLE IF NOT EXISTS `portfolio_asset_setting` (
  `id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `asset_symbol` VARCHAR(50) NOT NULL,
  `is_stablecoin` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

  UNIQUE INDEX `uniq_portfolio_asset_setting_account_symbol`(`account_id`, `asset_symbol`),
  INDEX `idx_portfolio_asset_setting_account`(`account_id`),
  CONSTRAINT `fk_portfolio_asset_setting_account`
    FOREIGN KEY (`account_id`) REFERENCES `account`(`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

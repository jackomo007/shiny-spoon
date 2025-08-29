-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `email` VARCHAR(255) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `public_id`(`public_id`),
    UNIQUE INDEX `email`(`email`),
    UNIQUE INDEX `username`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account` (
    `id` CHAR(36) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `type` ENUM('crypto', 'stock', 'forex') NOT NULL,
    `name` VARCHAR(100) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_account_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `strategy` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NULL,
    `date_created` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `account_id` CHAR(36) NOT NULL,

    INDEX `fk_strategy_account`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rule` (
    `id` CHAR(36) NOT NULL,
    `raw_input` TEXT NOT NULL,
    `normalized` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `normalized`(`normalized`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `strategy_rule` (
    `id` CHAR(36) NOT NULL,
    `strategy_id` CHAR(36) NOT NULL,
    `rule_id` CHAR(36) NOT NULL,
    `date_created` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `rule_id`(`rule_id`),
    INDEX `strategy_id`(`strategy_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entry` (
    `id` CHAR(36) NOT NULL,
    `account_id` VARCHAR(191) NOT NULL,
    `trade_type` INTEGER NOT NULL,
    `asset_name` VARCHAR(50) NOT NULL,
    `side` ENUM('buy', 'sell', 'long', 'short') NOT NULL,
    `status` ENUM('in-progress', 'win', 'loss', 'break-even') NOT NULL DEFAULT 'in-progress',
    `entry_price` DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
    `exit_price` DECIMAL(18, 8) NULL,
    `amount` DECIMAL(18, 8) NOT NULL,
    `trade_datetime` DATETIME(0) NOT NULL,
    `strategy_id` CHAR(36) NOT NULL,
    `notes_entry` TEXT NULL,
    `notes_review` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `strategy_rule_match` INTEGER NOT NULL,

    INDEX `fk_journal_entry_strategy`(`strategy_id`),
    INDEX `fk_journal_entry_account`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spot_trade` (
    `id` CHAR(36) NOT NULL,
    `journal_entry_id` CHAR(36) NOT NULL,

    INDEX `journal_entry_id`(`journal_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `futures_trade` (
    `id` CHAR(36) NOT NULL,
    `journal_entry_id` CHAR(36) NOT NULL,
    `leverage` INTEGER NOT NULL,
    `margin_used` DECIMAL(18, 8) NOT NULL,
    `liquidation_price` DECIMAL(18, 8) NOT NULL,

    INDEX `journal_entry_id`(`journal_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fear_greed_index` (
    `id` CHAR(36) NOT NULL,
    `score` INTEGER NOT NULL,
    `value_text` VARCHAR(50) NULL,
    `recorded_at` DATE NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_crypto_market_snapshot` (
    `id` CHAR(36) NOT NULL,
    `market_cap_usd` DECIMAL(20, 2) NOT NULL,
    `btc_dominance` DECIMAL(5, 2) NOT NULL,
    `usdt_dominance` DECIMAL(5, 2) NOT NULL,
    `recorded_at` DATE NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funding_rate` (
    `id` CHAR(36) NOT NULL,
    `symbol` VARCHAR(20) NOT NULL,
    `funding_rate` DECIMAL(10, 8) NOT NULL,
    `funding_time` DATETIME(0) NOT NULL,
    `recorded_at` DATE NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crypto_open_interest` (
    `id` CHAR(36) NOT NULL,
    `symbol` VARCHAR(20) NOT NULL,
    `exchange` VARCHAR(50) NULL,
    `open_interest_value` DECIMAL(20, 2) NOT NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'USD',
    `source` VARCHAR(20) NULL DEFAULT 'coinglass',
    `recorded_at` DATE NOT NULL,
    `fetched_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `fk_account_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `strategy` ADD CONSTRAINT `fk_strategy_account` FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `strategy_rule` ADD CONSTRAINT `strategy_rule_ibfk_1` FOREIGN KEY (`strategy_id`) REFERENCES `strategy`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `strategy_rule` ADD CONSTRAINT `strategy_rule_ibfk_2` FOREIGN KEY (`rule_id`) REFERENCES `rule`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_entry` ADD CONSTRAINT `fk_journal_entry_account` FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `spot_trade` ADD CONSTRAINT `spot_trade_ibfk_1` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entry`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `futures_trade` ADD CONSTRAINT `futures_trade_ibfk_1` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entry`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- CreateTable
CREATE TABLE `trade_pre_analysis` (
    `id` CHAR(36) NOT NULL,
    `account_id` CHAR(36) NOT NULL,
    `strategy_id` CHAR(36) NULL,
    `asset_symbol` VARCHAR(50) NOT NULL,
    `trade_type` INTEGER NOT NULL,
    `side` ENUM('buy', 'sell', 'long', 'short') NOT NULL,
    `amount_spent` DECIMAL(18, 8) NOT NULL,
    `entry_price` DECIMAL(18, 8) NOT NULL,
    `target_price` DECIMAL(18, 8) NULL,
    `stop_price` DECIMAL(18, 8) NULL,
    `timeframe` ENUM('h1', 'h4', 'd1') NOT NULL,
    `chart_image` VARCHAR(191) NOT NULL,
    `analysis_text` VARCHAR(191) NOT NULL,
    `model_used` VARCHAR(191) NULL,
    `prompt_used` VARCHAR(191) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_pre_analysis_acc_created`(`account_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trade_pre_analysis` ADD CONSTRAINT `trade_pre_analysis_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_pre_analysis` ADD CONSTRAINT `trade_pre_analysis_strategy_id_fkey` FOREIGN KEY (`strategy_id`) REFERENCES `strategy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

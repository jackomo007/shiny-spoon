-- CreateTable
CREATE TABLE `ai_usage` (
    `id` CHAR(36) NOT NULL,
    `kind` ENUM('chart', 'trade') NOT NULL,
    `model_used` VARCHAR(100) NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `cost_usd` DECIMAL(12, 6) NOT NULL DEFAULT 0.00,
    `account_id` INTEGER NULL,
    `tracker_id` CHAR(36) NULL,
    `pre_analysis_id` CHAR(36) NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_ai_usage_kind`(`kind`),
    INDEX `idx_ai_usage_created_at`(`created_at`),
    INDEX `idx_ai_usage_account`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

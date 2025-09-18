-- CreateTable
CREATE TABLE `chart_tracker` (
    `id` CHAR(36) NOT NULL,
    `tv_symbol` VARCHAR(100) NOT NULL,
    `display_symbol` VARCHAR(50) NOT NULL,
    `tf` ENUM('h1', 'h4', 'd1') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `last_run_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_chart_tf`(`tf`),
    UNIQUE INDEX `uniq_tv_symbol_tf`(`tv_symbol`, `tf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chart_subscription` (
    `id` CHAR(36) NOT NULL,
    `account_id` CHAR(36) NOT NULL,
    `tracker_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_subscription_tracker`(`tracker_id`),
    UNIQUE INDEX `uniq_account_tracker`(`account_id`, `tracker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chart_analysis` (
    `id` CHAR(36) NOT NULL,
    `tracker_id` CHAR(36) NOT NULL,
    `image_url` TEXT NOT NULL,
    `analysis_text` TEXT NOT NULL,
    `model_used` VARCHAR(50) NULL,
    `prompt_used` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_analysis_tracker_created`(`tracker_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chart_subscription` ADD CONSTRAINT `fk_subscription_account` FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_subscription` ADD CONSTRAINT `fk_subscription_tracker` FOREIGN KEY (`tracker_id`) REFERENCES `chart_tracker`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_analysis` ADD CONSTRAINT `fk_analysis_tracker` FOREIGN KEY (`tracker_id`) REFERENCES `chart_tracker`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

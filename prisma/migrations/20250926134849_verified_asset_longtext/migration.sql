-- CreateTable
CREATE TABLE `verified_asset` (
    `id` CHAR(36) NOT NULL,
    `symbol` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NULL,
    `exchange` VARCHAR(50) NOT NULL DEFAULT 'Binance',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `verified_asset_symbol_key`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

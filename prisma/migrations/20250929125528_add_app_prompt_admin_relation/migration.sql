-- AlterTable
ALTER TABLE `user` ADD COLUMN `is_admin` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `app_prompt` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NULL,
    `content` LONGTEXT NOT NULL,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `app_prompt_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `app_prompt` ADD CONSTRAINT `app_prompt_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

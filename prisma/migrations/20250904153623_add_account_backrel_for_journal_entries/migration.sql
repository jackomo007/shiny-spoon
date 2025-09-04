/*
  Warnings:

  - Added the required column `amount_spent` to the `journal_entry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `journal_id` to the `journal_entry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `journal_entry` ADD COLUMN `amount_spent` DECIMAL(18, 8) NOT NULL,
    ADD COLUMN `journal_id` CHAR(36) NOT NULL;

-- CreateTable
CREATE TABLE `journal` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `account_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_journal_account`(`account_id`),
    UNIQUE INDEX `uniq_account_name`(`account_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `fk_journal_entry_journal` ON `journal_entry`(`journal_id`);

-- AddForeignKey
ALTER TABLE `journal` ADD CONSTRAINT `fk_journal_account` FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_entry` ADD CONSTRAINT `fk_journal_entry_journal` FOREIGN KEY (`journal_id`) REFERENCES `journal`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

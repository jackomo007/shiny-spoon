-- AlterTable
ALTER TABLE `journal_entry` ADD COLUMN `stop_loss_price` DECIMAL(18, 8) NULL,
    ADD COLUMN `take_profit_price` DECIMAL(18, 8) NULL;

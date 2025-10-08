-- AlterTable
ALTER TABLE `journal_entry`
  ADD COLUMN `trading_fee` DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000;

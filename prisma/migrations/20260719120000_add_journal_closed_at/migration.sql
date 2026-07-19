ALTER TABLE `journal_entry`
  ADD COLUMN `closed_at` DATETIME(0) NULL AFTER `trade_datetime`;

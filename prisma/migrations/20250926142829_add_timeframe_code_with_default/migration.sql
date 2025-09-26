/*
  Warnings:

  - You are about to drop the column `timeframe` on the `trade_pre_analysis` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `trade_pre_analysis` DROP COLUMN `timeframe`,
    ADD COLUMN `timeframe_code` VARCHAR(8) NOT NULL DEFAULT '1H';

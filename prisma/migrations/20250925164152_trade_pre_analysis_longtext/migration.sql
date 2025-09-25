/*
  Warnings:

  - You are about to alter the column `model_used` on the `trade_pre_analysis` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.

*/
-- AlterTable
ALTER TABLE `trade_pre_analysis` MODIFY `chart_image` VARCHAR(2048) NOT NULL,
    MODIFY `analysis_text` LONGTEXT NOT NULL,
    MODIFY `model_used` VARCHAR(100) NULL,
    MODIFY `prompt_used` LONGTEXT NULL;

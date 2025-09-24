-- AlterTable
ALTER TABLE `futures_trade` MODIFY `liquidation_price` DECIMAL(18, 8) NULL;

-- AlterTable
ALTER TABLE `journal_entry` ADD COLUMN `buy_fee` DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
    ADD COLUMN `sell_fee` DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
    ADD COLUMN `timeframe_code` VARCHAR(8) NOT NULL DEFAULT '1D';

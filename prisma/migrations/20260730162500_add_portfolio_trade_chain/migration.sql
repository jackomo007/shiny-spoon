ALTER TABLE `portfolio_trade`
  ADD COLUMN `chain_id` VARCHAR(80) NULL AFTER `cash_delta_usd`;

CREATE INDEX `idx_pt_acc_asset_chain` ON `portfolio_trade`(`account_id`, `asset_name`, `chain_id`);

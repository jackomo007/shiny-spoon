ALTER TABLE `exit_strategy`
  ADD COLUMN `excluded_coin_symbols_json` LONGTEXT NULL AFTER `is_all_coins`;

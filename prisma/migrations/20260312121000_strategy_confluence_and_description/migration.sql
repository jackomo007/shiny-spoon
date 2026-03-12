ALTER TABLE `strategy`
  CHANGE COLUMN `notes` `description` TEXT NULL;

ALTER TABLE `strategy_rule`
  DROP FOREIGN KEY `strategy_rule_ibfk_2`;

RENAME TABLE `rule` TO `confluence`;
RENAME TABLE `strategy_rule` TO `strategy_confluence`;

ALTER TABLE `strategy_confluence`
  CHANGE COLUMN `rule_id` `confluence_id` CHAR(36) NOT NULL;

ALTER TABLE `strategy_confluence`
  ADD CONSTRAINT `strategy_rule_ibfk_2`
  FOREIGN KEY (`confluence_id`) REFERENCES `confluence`(`id`)
  ON DELETE CASCADE
  ON UPDATE RESTRICT;

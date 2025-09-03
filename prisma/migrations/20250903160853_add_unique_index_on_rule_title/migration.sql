/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `rule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `rule_title_key` ON `rule`(`title`);

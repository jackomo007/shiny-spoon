/*
  Warnings:

  - A unique constraint covering the columns `[user_id,type]` on the table `account` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `uniq_user_type` ON `account`(`user_id`, `type`);

/*
  Warnings:

  - You are about to drop the column `normalized` on the `rule` table. All the data in the column will be lost.
  - You are about to drop the column `raw_input` on the `rule` table. All the data in the column will be lost.
  - Added the required column `title` to the `rule` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `normalized` ON `rule`;

-- AlterTable
ALTER TABLE `rule` DROP COLUMN `normalized`,
    DROP COLUMN `raw_input`,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `title` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `rule_title_idx` ON `rule`(`title`);

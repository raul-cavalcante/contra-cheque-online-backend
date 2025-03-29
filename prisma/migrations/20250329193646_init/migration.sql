/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `Payslip` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cpf` to the `Payslip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `payslip` ADD COLUMN `cpf` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Payslip_cpf_key` ON `Payslip`(`cpf`);

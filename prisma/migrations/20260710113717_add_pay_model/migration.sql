-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionPct" INTEGER,
ADD COLUMN     "monthlySalary" INTEGER,
ADD COLUMN     "payModel" TEXT NOT NULL DEFAULT 'fast';

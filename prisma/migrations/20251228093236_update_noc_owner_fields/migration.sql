/*
  Warnings:

  - You are about to drop the column `owners` on the `Noc` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Noc" DROP COLUMN "owners",
ADD COLUMN     "owner1CountryCode" TEXT,
ADD COLUMN     "owner1EmiratesId" TEXT,
ADD COLUMN     "owner1ExpiryDate" TIMESTAMP(3),
ADD COLUMN     "owner1IssueDate" TIMESTAMP(3),
ADD COLUMN     "owner1Name" TEXT,
ADD COLUMN     "owner1Phone" TEXT,
ADD COLUMN     "owner2CountryCode" TEXT,
ADD COLUMN     "owner2EmiratesId" TEXT,
ADD COLUMN     "owner2ExpiryDate" TIMESTAMP(3),
ADD COLUMN     "owner2IssueDate" TIMESTAMP(3),
ADD COLUMN     "owner2Name" TEXT,
ADD COLUMN     "owner2Phone" TEXT,
ADD COLUMN     "owner3CountryCode" TEXT,
ADD COLUMN     "owner3EmiratesId" TEXT,
ADD COLUMN     "owner3ExpiryDate" TIMESTAMP(3),
ADD COLUMN     "owner3IssueDate" TIMESTAMP(3),
ADD COLUMN     "owner3Name" TEXT,
ADD COLUMN     "owner3Phone" TEXT;

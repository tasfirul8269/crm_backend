/*
  Warnings:

  - You are about to drop the column `owner1CountryCode` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner1EmiratesId` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner1ExpiryDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner1IssueDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner1Name` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner1Phone` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner1Signature` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner1SignatureDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2CountryCode` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2EmiratesId` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2ExpiryDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2IssueDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2Name` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2Phone` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2Signature` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner2SignatureDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner3CountryCode` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner3EmiratesId` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner3ExpiryDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner3IssueDate` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner3Name` on the `Noc` table. All the data in the column will be lost.
  - You are about to drop the column `owner3Phone` on the `Noc` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clientPhone]` on the table `Noc` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Noc" DROP COLUMN "owner1CountryCode",
DROP COLUMN "owner1EmiratesId",
DROP COLUMN "owner1ExpiryDate",
DROP COLUMN "owner1IssueDate",
DROP COLUMN "owner1Name",
DROP COLUMN "owner1Phone",
DROP COLUMN "owner1Signature",
DROP COLUMN "owner1SignatureDate",
DROP COLUMN "owner2CountryCode",
DROP COLUMN "owner2EmiratesId",
DROP COLUMN "owner2ExpiryDate",
DROP COLUMN "owner2IssueDate",
DROP COLUMN "owner2Name",
DROP COLUMN "owner2Phone",
DROP COLUMN "owner2Signature",
DROP COLUMN "owner2SignatureDate",
DROP COLUMN "owner3CountryCode",
DROP COLUMN "owner3EmiratesId",
DROP COLUMN "owner3ExpiryDate",
DROP COLUMN "owner3IssueDate",
DROP COLUMN "owner3Name",
DROP COLUMN "owner3Phone",
ADD COLUMN     "clientPhone" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationSoundEnd" DOUBLE PRECISION,
ADD COLUMN     "notificationSoundStart" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "notificationSoundUrl" TEXT,
ADD COLUMN     "sidebarMenuOrder" TEXT[],
ADD COLUMN     "useCustomNotificationSound" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NocOwner" (
    "id" TEXT NOT NULL,
    "nocId" TEXT NOT NULL,
    "name" TEXT,
    "emiratesId" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "countryCode" TEXT,
    "phone" TEXT,
    "signatureUrl" TEXT,
    "signatureDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NocOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "size" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "folderId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "accessIds" TEXT[],
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyContract" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "tenantName" TEXT,
    "tenantEmail" TEXT,
    "tenantPhone" TEXT,
    "propertyUsage" TEXT,
    "buildingName" TEXT,
    "location" TEXT,
    "propertySize" DOUBLE PRECISION,
    "propertyType" TEXT,
    "propertyNumber" TEXT,
    "plotNumber" TEXT,
    "premisesNumber" TEXT,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "annualRent" DOUBLE PRECISION,
    "contractValue" DOUBLE PRECISION,
    "securityDeposit" DOUBLE PRECISION,
    "modeOfPayment" TEXT,
    "additionalTerms" JSONB,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Noc_clientPhone_key" ON "Noc"("clientPhone");

-- AddForeignKey
ALTER TABLE "NocOwner" ADD CONSTRAINT "NocOwner_nocId_fkey" FOREIGN KEY ("nocId") REFERENCES "Noc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyContract" ADD CONSTRAINT "TenancyContract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

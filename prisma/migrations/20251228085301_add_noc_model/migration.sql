-- CreateTable
CREATE TABLE "PropertyDraft" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "originalPropertyId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Noc" (
    "id" TEXT NOT NULL,
    "owners" JSONB NOT NULL,
    "propertyType" TEXT,
    "buildingProjectName" TEXT,
    "community" TEXT,
    "streetName" TEXT,
    "buildUpArea" DOUBLE PRECISION,
    "plotArea" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "rentalAmount" DOUBLE PRECISION,
    "saleAmount" DOUBLE PRECISION,
    "parking" TEXT,
    "agreementType" TEXT,
    "periodMonths" INTEGER,
    "agreementDate" TIMESTAMP(3),
    "owner1Signature" TEXT,
    "owner1SignatureDate" TIMESTAMP(3),
    "owner2Signature" TEXT,
    "owner2SignatureDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Noc_pkey" PRIMARY KEY ("id")
);

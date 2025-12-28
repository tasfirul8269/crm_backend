-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "minCharacters" INTEGER NOT NULL DEFAULT 750,
    "maxCharacters" INTEGER NOT NULL DEFAULT 2000,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "modelName" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTrainingExample" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTrainingExample_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AiSettings" ADD COLUMN     "maxTitleCharacters" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "minTitleCharacters" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "AiTrainingExample" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'description';

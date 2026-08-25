-- AlterTable
ALTER TABLE "License" ADD COLUMN     "activationStatus" TEXT NOT NULL DEFAULT 'UNACTIVATED',
ADD COLUMN     "machineId" TEXT;

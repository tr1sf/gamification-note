-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyCoinsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyXpEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRewardResetDate" TIMESTAMP(3);

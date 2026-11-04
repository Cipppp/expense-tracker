-- AlterTable
ALTER TABLE "MealChoice" ADD COLUMN     "eaten" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MealCheckIn" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealShoppingWeek" (
    "userId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "checked" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealShoppingWeek_pkey" PRIMARY KEY ("userId","week")
);

-- CreateIndex
CREATE INDEX "MealCheckIn_userId_idx" ON "MealCheckIn"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealCheckIn_userId_person_day_key" ON "MealCheckIn"("userId", "person", "day");

-- AddForeignKey
ALTER TABLE "MealCheckIn" ADD CONSTRAINT "MealCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealShoppingWeek" ADD CONSTRAINT "MealShoppingWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


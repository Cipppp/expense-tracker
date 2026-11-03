-- CreateTable
CREATE TABLE "MealChoice" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealChoice_userId_idx" ON "MealChoice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealChoice_userId_day_person_meal_key" ON "MealChoice"("userId", "day", "person", "meal");

-- AddForeignKey
ALTER TABLE "MealChoice" ADD CONSTRAINT "MealChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

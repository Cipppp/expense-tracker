-- Multi-user: fiecare rand primeste un proprietar.
--
-- Ordinea celor trei parti conteaza:
--   1. tabela User si coloanele `userId`, adaugate ca NULL — o coloana NOT NULL
--      fara valoare implicita pica pe orice tabela care are deja randuri, iar o
--      cheie primara nu accepta NULL, deci si ea asteapta.
--   2. contul "owner", caruia i se leaga tot ce exista acum. Emailul si parola
--      sunt provizorii; `npm run adopt-owner` le inlocuieste cu cele reale.
--   3. de-abia dupa ce datele au proprietar: NOT NULL, chei primare, indexuri.
--
-- Fara pasul 2 intre 1 si 3, migrarea pica la mijloc si lasa baza pe jumatate.

-- 1. structura
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
DROP INDEX "CategoryRule_keyword_key";
DROP INDEX "CompanyPayout_dedupKey_key";
DROP INDEX "Holding_symbol_source_key";
DROP INDEX "Invoice_number_key";
DROP INDEX "Job_name_key";
DROP INDEX "Supplement_key_key";
DROP INDEX "SupplementLog_day_person_key_key";
DROP INDEX "TaxPayment_dedupKey_key";
ALTER TABLE "AnafToken" ADD COLUMN     "userId" TEXT;
ALTER TABLE "CategoryRule" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Chore" ADD COLUMN     "userId" TEXT;
ALTER TABLE "ChoreWeek" DROP CONSTRAINT "ChoreWeek_pkey", ADD COLUMN "userId" TEXT;
ALTER TABLE "CompanyPayout" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Expense" ADD COLUMN     "userId" TEXT;
ALTER TABLE "GratitudeItem" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Holding" ADD COLUMN     "userId" TEXT;
ALTER TABLE "ImportBatch" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Income" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Job" ADD COLUMN     "userId" TEXT;
ALTER TABLE "NetWorthSnapshot" DROP CONSTRAINT "NetWorthSnapshot_pkey", ADD COLUMN "userId" TEXT;
ALTER TABLE "Passkey" ADD COLUMN     "userId" TEXT;
ALTER TABLE "SavingsAccount" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_pkey", DROP COLUMN "id", ADD COLUMN "userId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Supplement" ADD COLUMN     "userId" TEXT;
ALTER TABLE "SupplementLog" ADD COLUMN     "userId" TEXT;
ALTER TABLE "TaxPayment" ADD COLUMN     "userId" TEXT;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnafToken" ADD CONSTRAINT "AnafToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxPayment" ADD CONSTRAINT "TaxPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPayout" ADD CONSTRAINT "CompanyPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChoreWeek" ADD CONSTRAINT "ChoreWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GratitudeItem" ADD CONSTRAINT "GratitudeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Supplement" ADD CONSTRAINT "Supplement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplementLog" ADD CONSTRAINT "SupplementLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. contul care preia datele existente
INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt", "updatedAt")
VALUES ('owner', 'owner@localhost', '', 'Owner', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
UPDATE "Expense" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Income" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Job" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Invoice" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Subscription" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "TaxPayment" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "CompanyPayout" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Holding" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "SavingsAccount" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "NetWorthSnapshot" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Chore" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "ChoreWeek" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "GratitudeItem" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Supplement" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "SupplementLog" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "ImportBatch" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "CategoryRule" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Passkey" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "AnafToken" SET "userId" = 'owner' WHERE "userId" IS NULL;
UPDATE "Settings" SET "userId" = 'owner' WHERE "userId" IS NULL;

-- 3. obligatoriu, chei, indexuri
ALTER TABLE "Expense" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Income" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "TaxPayment" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "CompanyPayout" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Holding" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "SavingsAccount" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "NetWorthSnapshot" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Chore" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ChoreWeek" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "GratitudeItem" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Supplement" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "SupplementLog" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ImportBatch" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "CategoryRule" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Passkey" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AnafToken" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Settings" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ChoreWeek" ADD CONSTRAINT "ChoreWeek_pkey" PRIMARY KEY ("userId", "isoWeek");
ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("userId", "day");
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_pkey" PRIMARY KEY ("userId");
-- AnafToken era cheiat pe `id = 1`, adica un singur token pentru toata
-- instalarea. Acum tokenul apartine contului, deci cheia devine userId.
ALTER TABLE "AnafToken" DROP CONSTRAINT "AnafToken_pkey", DROP COLUMN "id";
ALTER TABLE "AnafToken" ADD CONSTRAINT "AnafToken_pkey" PRIMARY KEY ("userId");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "AnafToken_userId_idx" ON "AnafToken"("userId");
CREATE INDEX "CategoryRule_userId_idx" ON "CategoryRule"("userId");
CREATE UNIQUE INDEX "CategoryRule_userId_keyword_key" ON "CategoryRule"("userId", "keyword");
CREATE INDEX "Chore_userId_idx" ON "Chore"("userId");
CREATE UNIQUE INDEX "CompanyPayout_userId_dedupKey_key" ON "CompanyPayout"("userId", "dedupKey");
CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");
CREATE INDEX "GratitudeItem_userId_idx" ON "GratitudeItem"("userId");
CREATE INDEX "Holding_userId_idx" ON "Holding"("userId");
CREATE UNIQUE INDEX "Holding_userId_symbol_source_key" ON "Holding"("userId", "symbol", "source");
CREATE INDEX "ImportBatch_userId_idx" ON "ImportBatch"("userId");
CREATE INDEX "Income_userId_idx" ON "Income"("userId");
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");
CREATE INDEX "Job_userId_idx" ON "Job"("userId");
CREATE UNIQUE INDEX "Job_userId_name_key" ON "Job"("userId", "name");
CREATE INDEX "Passkey_userId_idx" ON "Passkey"("userId");
CREATE INDEX "SavingsAccount_userId_idx" ON "SavingsAccount"("userId");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX "Supplement_userId_idx" ON "Supplement"("userId");
CREATE UNIQUE INDEX "Supplement_userId_key_key" ON "Supplement"("userId", "key");
CREATE INDEX "SupplementLog_userId_idx" ON "SupplementLog"("userId");
CREATE UNIQUE INDEX "SupplementLog_userId_day_person_key_key" ON "SupplementLog"("userId", "day", "person", "key");
CREATE UNIQUE INDEX "TaxPayment_userId_dedupKey_key" ON "TaxPayment"("userId", "dedupKey");

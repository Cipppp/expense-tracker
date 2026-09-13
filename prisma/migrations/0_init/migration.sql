-- Punctul de plecare: aplicatia asa cum arata inainte de conturi.
--
-- Nu e scrisa de mana, ci extrasa din baza care rula deja in productie, pentru
-- ca istoricul a inceput dupa ea. De-aia nu are "User" si nicio coloana
-- "userId" — alea vin din migrarea urmatoare, care le adauga peste date
-- existente. Daca le-ar avea si aici, cele doua migrari s-ar bate cap in cap
-- si lantul n-ar mai putea fi rulat de la zero pe o baza goala.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."AnafToken" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "certSerial" TEXT,
    "obtainedAt" TIMESTAMP(3) NOT NULL,
    "refreshedAt" TIMESTAMP(3),
    "lastHealthOk" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "needsReauth" BOOLEAN NOT NULL DEFAULT false,
    "refreshingAt" TIMESTAMP(3),

    CONSTRAINT "AnafToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CategoryRule" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Chore" (
    "id" TEXT NOT NULL,
    "setId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "shopping" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChoreWeek" (
    "isoWeek" TEXT NOT NULL,
    "done" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreWeek_pkey" PRIMARY KEY ("isoWeek")
);

-- CreateTable
CREATE TABLE "public"."CompanyPayout" (
    "id" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "forPeriod" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountRon" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "presumed" BOOLEAN NOT NULL DEFAULT false,
    "dedupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EfacturaSubmission" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "env" TEXT NOT NULL,
    "standard" TEXT NOT NULL DEFAULT 'UBL',
    "extern" BOOLEAN NOT NULL DEFAULT false,
    "xmlSent" TEXT NOT NULL,
    "xmlSha256" TEXT NOT NULL,
    "indexIncarcare" TEXT,
    "idDescarcare" TEXT,
    "state" TEXT NOT NULL,
    "stareRaw" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "stateCheckedAt" TIMESTAMP(3),
    "stateChecksDay" TEXT,
    "stateChecksN" INTEGER NOT NULL DEFAULT 0,
    "downloadsDay" TEXT,
    "downloadsN" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "zipS3Key" TEXT,
    "xmlS3Key" TEXT,
    "signatureS3Key" TEXT,
    "zipInline" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EfacturaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "amountRon" INTEGER NOT NULL,
    "amountUsd" INTEGER NOT NULL,
    "fxRate" DOUBLE PRECISION NOT NULL,
    "merchant" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "dedupKey" TEXT NOT NULL,
    "sortKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GratitudeItem" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoKey" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "GratitudeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GratitudeReaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GratitudeReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Holding" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "avgCost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowsRead" INTEGER NOT NULL,
    "rowsInsert" INTEGER NOT NULL,
    "rowsSkipped" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Income" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "hours" DOUBLE PRECISION,
    "hourlyRate" DOUBLE PRECISION,
    "amountUsd" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endMinutes" INTEGER,
    "jobId" TEXT,
    "startMinutes" INTEGER,
    "invoiceId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidVia" TEXT,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT 'CP',
    "seriesNumber" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "jobId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientCompany" TEXT NOT NULL,
    "clientCui" TEXT,
    "clientReg" TEXT,
    "clientAddress" TEXT,
    "clientCountry" TEXT,
    "invoiceCurrency" TEXT NOT NULL DEFAULT 'RON',
    "legalCurrency" TEXT NOT NULL DEFAULT 'RON',
    "bnrRate" DOUBLE PRECISION,
    "footerNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidAt" TIMESTAMP(3),
    "paidIncomeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oblioLink" TEXT,
    "oblioNumber" TEXT,
    "clientCounty" TEXT,
    "efacturaCurrentId" TEXT,
    "efacturaPolicy" TEXT NOT NULL DEFAULT 'auto',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'buc',
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateUsd" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#c65c2a',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyAddress" TEXT,
    "companyCountry" TEXT,
    "companyCui" TEXT,
    "companyName" TEXT,
    "companyReg" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "email" TEXT,
    "invoiceDescription" TEXT,
    "companyCounty" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NetWorthSnapshot" (
    "day" TEXT NOT NULL,
    "stocksRon" INTEGER NOT NULL,
    "savingsRon" INTEGER NOT NULL,
    "totalRon" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "public"."Passkey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT NOT NULL DEFAULT '',
    "deviceType" TEXT NOT NULL DEFAULT 'singleDevice',
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavingsAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountRon" INTEGER NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fxRonToUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.2255,
    "bsBasRon" INTEGER NOT NULL DEFAULT 141500,
    "camRon" INTEGER NOT NULL DEFAULT 8400,
    "microPct" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "dividendePct" DOUBLE PRECISION NOT NULL DEFAULT 0.16,
    "redThresholdRon" INTEGER NOT NULL DEFAULT 5000,
    "startYear" INTEGER NOT NULL DEFAULT 2026,
    "startMonth" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceSeries" TEXT NOT NULL DEFAULT 'CP',
    "issuerAddress" TEXT NOT NULL DEFAULT '',
    "issuerBank" TEXT NOT NULL DEFAULT '',
    "issuerCapital" TEXT NOT NULL DEFAULT '',
    "issuerCif" TEXT NOT NULL DEFAULT '',
    "issuerIban" TEXT NOT NULL DEFAULT '',
    "issuerName" TEXT NOT NULL DEFAULT '',
    "issuerReg" TEXT NOT NULL DEFAULT '',
    "issuerSigner" TEXT NOT NULL DEFAULT '',
    "displayCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "timelogToken" TEXT,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.21,
    "invoiceStartNumber" INTEGER NOT NULL DEFAULT 1,
    "senderEmail" TEXT NOT NULL DEFAULT '',
    "senderName" TEXT NOT NULL DEFAULT '',
    "issuerIbanEur" TEXT NOT NULL DEFAULT '',
    "issuerSwift" TEXT NOT NULL DEFAULT '',
    "choresFlip" BOOLEAN NOT NULL DEFAULT false,
    "fxEurToUsd" DOUBLE PRECISION NOT NULL DEFAULT 1.1833,
    "issuerVatIntra" TEXT NOT NULL DEFAULT '',
    "vatRegistered" BOOLEAN NOT NULL DEFAULT true,
    "issuerIbanUsd" TEXT NOT NULL DEFAULT '',
    "ownerNames" TEXT NOT NULL DEFAULT '',
    "personAColor" TEXT NOT NULL DEFAULT '',
    "personAName" TEXT NOT NULL DEFAULT '',
    "personBColor" TEXT NOT NULL DEFAULT '',
    "personBName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Subscriptions',
    "amountRon" INTEGER NOT NULL,
    "amountUsd" INTEGER NOT NULL,
    "fxRate" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Supplement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "short" TEXT NOT NULL DEFAULT '',
    "benefits" TEXT[],
    "unit" TEXT NOT NULL DEFAULT 'capsulă',
    "target" INTEGER NOT NULL DEFAULT 1,
    "timing" TEXT NOT NULL,
    "timingNote" TEXT NOT NULL DEFAULT '',
    "foodNote" TEXT NOT NULL DEFAULT '',
    "composition" TEXT NOT NULL DEFAULT '',
    "interactions" TEXT[],
    "cautions" TEXT[],
    "daily" BOOLEAN NOT NULL DEFAULT true,
    "suggestedFor" TEXT,
    "contributes" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplementLog" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxPayment" (
    "id" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "forPeriod" TEXT,
    "kind" TEXT NOT NULL,
    "amountRon" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRule_keyword_key" ON "public"."CategoryRule"("keyword" ASC);

-- CreateIndex
CREATE INDEX "Chore_setId_day_position_idx" ON "public"."Chore"("setId" ASC, "day" ASC, "position" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPayout_dedupKey_key" ON "public"."CompanyPayout"("dedupKey" ASC);

-- CreateIndex
CREATE INDEX "CompanyPayout_forPeriod_idx" ON "public"."CompanyPayout"("forPeriod" ASC);

-- CreateIndex
CREATE INDEX "CompanyPayout_kind_idx" ON "public"."CompanyPayout"("kind" ASC);

-- CreateIndex
CREATE INDEX "CompanyPayout_paidAt_idx" ON "public"."CompanyPayout"("paidAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EfacturaSubmission_indexIncarcare_key" ON "public"."EfacturaSubmission"("indexIncarcare" ASC);

-- CreateIndex
CREATE INDEX "EfacturaSubmission_invoiceId_idx" ON "public"."EfacturaSubmission"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "EfacturaSubmission_state_idx" ON "public"."EfacturaSubmission"("state" ASC);

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "public"."Expense"("category" ASC);

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "public"."Expense"("date" ASC);

-- CreateIndex
CREATE INDEX "Expense_dedupKey_idx" ON "public"."Expense"("dedupKey" ASC);

-- CreateIndex
CREATE INDEX "Expense_excluded_idx" ON "public"."Expense"("excluded" ASC);

-- CreateIndex
CREATE INDEX "Expense_merchant_idx" ON "public"."Expense"("merchant" ASC);

-- CreateIndex
CREATE INDEX "GratitudeItem_createdAt_idx" ON "public"."GratitudeItem"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "GratitudeReaction_itemId_idx" ON "public"."GratitudeReaction"("itemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "GratitudeReaction_itemId_person_key" ON "public"."GratitudeReaction"("itemId" ASC, "person" ASC);

-- CreateIndex
CREATE INDEX "Holding_source_idx" ON "public"."Holding"("source" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Holding_symbol_source_key" ON "public"."Holding"("symbol" ASC, "source" ASC);

-- CreateIndex
CREATE INDEX "Income_date_idx" ON "public"."Income"("date" ASC);

-- CreateIndex
CREATE INDEX "Income_invoiceId_idx" ON "public"."Income"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "Income_jobId_idx" ON "public"."Income"("jobId" ASC);

-- CreateIndex
CREATE INDEX "Income_source_idx" ON "public"."Income"("source" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_efacturaCurrentId_key" ON "public"."Invoice"("efacturaCurrentId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "public"."Invoice"("issuedAt" ASC);

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "public"."Invoice"("jobId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "public"."Invoice"("number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paidIncomeId_key" ON "public"."Invoice"("paidIncomeId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "public"."Invoice"("status" ASC);

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "public"."InvoiceLine"("invoiceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Job_name_key" ON "public"."Job"("name" ASC);

-- CreateIndex
CREATE INDEX "Passkey_credentialId_idx" ON "public"."Passkey"("credentialId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "public"."Passkey"("credentialId" ASC);

-- CreateIndex
CREATE INDEX "Subscription_active_idx" ON "public"."Subscription"("active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Supplement_key_key" ON "public"."Supplement"("key" ASC);

-- CreateIndex
CREATE INDEX "Supplement_timing_position_idx" ON "public"."Supplement"("timing" ASC, "position" ASC);

-- CreateIndex
CREATE INDEX "SupplementLog_day_idx" ON "public"."SupplementLog"("day" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SupplementLog_day_person_key_key" ON "public"."SupplementLog"("day" ASC, "person" ASC, "key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TaxPayment_dedupKey_key" ON "public"."TaxPayment"("dedupKey" ASC);

-- CreateIndex
CREATE INDEX "TaxPayment_forPeriod_idx" ON "public"."TaxPayment"("forPeriod" ASC);

-- CreateIndex
CREATE INDEX "TaxPayment_kind_idx" ON "public"."TaxPayment"("kind" ASC);

-- CreateIndex
CREATE INDEX "TaxPayment_paidAt_idx" ON "public"."TaxPayment"("paidAt" ASC);

-- AddForeignKey
ALTER TABLE "public"."EfacturaSubmission" ADD CONSTRAINT "EfacturaSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GratitudeReaction" ADD CONSTRAINT "GratitudeReaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."GratitudeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Income" ADD CONSTRAINT "Income_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Income" ADD CONSTRAINT "Income_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_efacturaCurrentId_fkey" FOREIGN KEY ("efacturaCurrentId") REFERENCES "public"."EfacturaSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


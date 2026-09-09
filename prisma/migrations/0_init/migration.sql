-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "userId" TEXT NOT NULL,
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
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "jobId" TEXT,
    "source" TEXT NOT NULL,
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,
    "hours" DOUBLE PRECISION,
    "hourlyRate" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountUsd" INTEGER NOT NULL,
    "notes" TEXT,
    "paidVia" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateUsd" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#c65c2a',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyName" TEXT,
    "companyCui" TEXT,
    "companyReg" TEXT,
    "companyAddress" TEXT,
    "companyCountry" TEXT,
    "companyCounty" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "email" TEXT,
    "invoiceDescription" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "userId" TEXT NOT NULL,
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
    "clientCounty" TEXT,
    "invoiceCurrency" TEXT NOT NULL DEFAULT 'RON',
    "legalCurrency" TEXT NOT NULL DEFAULT 'RON',
    "bnrRate" DOUBLE PRECISION,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "footerNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "oblioNumber" TEXT,
    "oblioLink" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidIncomeId" TEXT,
    "efacturaPolicy" TEXT NOT NULL DEFAULT 'auto',
    "efacturaCurrentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnafToken" (
    "userId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "certSerial" TEXT,
    "obtainedAt" TIMESTAMP(3) NOT NULL,
    "refreshedAt" TIMESTAMP(3),
    "refreshingAt" TIMESTAMP(3),
    "needsReauth" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthOk" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnafToken_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "EfacturaSubmission" (
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
CREATE TABLE "InvoiceLine" (
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
CREATE TABLE "Subscription" (
    "userId" TEXT NOT NULL,
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
CREATE TABLE "TaxPayment" (
    "userId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "CompanyPayout" (
    "userId" TEXT NOT NULL,
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
CREATE TABLE "Holding" (
    "userId" TEXT NOT NULL,
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
CREATE TABLE "SavingsAccount" (
    "userId" TEXT NOT NULL,
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
CREATE TABLE "NetWorthSnapshot" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "stocksRon" INTEGER NOT NULL,
    "savingsRon" INTEGER NOT NULL,
    "totalRon" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "Settings" (
    "userId" TEXT NOT NULL,
    "displayCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "timelogToken" TEXT,
    "fxRonToUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.2255,
    "fxEurToUsd" DOUBLE PRECISION NOT NULL DEFAULT 1.1833,
    "bsBasRon" INTEGER NOT NULL DEFAULT 141500,
    "camRon" INTEGER NOT NULL DEFAULT 8400,
    "microPct" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "dividendePct" DOUBLE PRECISION NOT NULL DEFAULT 0.16,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.21,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT true,
    "issuerVatIntra" TEXT NOT NULL DEFAULT '',
    "redThresholdRon" INTEGER NOT NULL DEFAULT 5000,
    "startYear" INTEGER NOT NULL DEFAULT 2026,
    "startMonth" INTEGER NOT NULL DEFAULT 4,
    "issuerName" TEXT NOT NULL DEFAULT '',
    "issuerCif" TEXT NOT NULL DEFAULT '',
    "issuerReg" TEXT NOT NULL DEFAULT '',
    "issuerAddress" TEXT NOT NULL DEFAULT '',
    "issuerIban" TEXT NOT NULL DEFAULT '',
    "issuerIbanEur" TEXT NOT NULL DEFAULT '',
    "issuerIbanUsd" TEXT NOT NULL DEFAULT '',
    "issuerSwift" TEXT NOT NULL DEFAULT '',
    "issuerBank" TEXT NOT NULL DEFAULT '',
    "issuerCapital" TEXT NOT NULL DEFAULT '',
    "issuerSigner" TEXT NOT NULL DEFAULT '',
    "senderEmail" TEXT NOT NULL DEFAULT '',
    "senderName" TEXT NOT NULL DEFAULT '',
    "invoiceSeries" TEXT NOT NULL DEFAULT 'CP',
    "invoiceStartNumber" INTEGER NOT NULL DEFAULT 1,
    "ownerNames" TEXT NOT NULL DEFAULT '',
    "personAName" TEXT NOT NULL DEFAULT '',
    "personAColor" TEXT NOT NULL DEFAULT '',
    "personBName" TEXT NOT NULL DEFAULT '',
    "personBColor" TEXT NOT NULL DEFAULT '',
    "choresFlip" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Chore" (
    "userId" TEXT NOT NULL,
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
CREATE TABLE "ChoreWeek" (
    "userId" TEXT NOT NULL,
    "isoWeek" TEXT NOT NULL,
    "done" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreWeek_pkey" PRIMARY KEY ("userId","isoWeek")
);

-- CreateTable
CREATE TABLE "GratitudeItem" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "photoKey" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GratitudeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GratitudeReaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GratitudeReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplement" (
    "userId" TEXT NOT NULL,
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
CREATE TABLE "SupplementLog" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowsRead" INTEGER NOT NULL,
    "rowsInsert" INTEGER NOT NULL,
    "rowsSkipped" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "userId" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_dedupKey_idx" ON "Expense"("dedupKey");

-- CreateIndex
CREATE INDEX "Expense_merchant_idx" ON "Expense"("merchant");

-- CreateIndex
CREATE INDEX "Expense_excluded_idx" ON "Expense"("excluded");

-- CreateIndex
CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");

-- CreateIndex
CREATE INDEX "Income_date_idx" ON "Income"("date");

-- CreateIndex
CREATE INDEX "Income_jobId_idx" ON "Income"("jobId");

-- CreateIndex
CREATE INDEX "Income_source_idx" ON "Income"("source");

-- CreateIndex
CREATE INDEX "Income_invoiceId_idx" ON "Income"("invoiceId");

-- CreateIndex
CREATE INDEX "Income_userId_idx" ON "Income"("userId");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_userId_name_key" ON "Job"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paidIncomeId_key" ON "Invoice"("paidIncomeId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_efacturaCurrentId_key" ON "Invoice"("efacturaCurrentId");

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "Invoice"("jobId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");

-- CreateIndex
CREATE INDEX "AnafToken_userId_idx" ON "AnafToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EfacturaSubmission_indexIncarcare_key" ON "EfacturaSubmission"("indexIncarcare");

-- CreateIndex
CREATE INDEX "EfacturaSubmission_invoiceId_idx" ON "EfacturaSubmission"("invoiceId");

-- CreateIndex
CREATE INDEX "EfacturaSubmission_state_idx" ON "EfacturaSubmission"("state");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Subscription_active_idx" ON "Subscription"("active");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "TaxPayment_paidAt_idx" ON "TaxPayment"("paidAt");

-- CreateIndex
CREATE INDEX "TaxPayment_forPeriod_idx" ON "TaxPayment"("forPeriod");

-- CreateIndex
CREATE INDEX "TaxPayment_kind_idx" ON "TaxPayment"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPayment_userId_dedupKey_key" ON "TaxPayment"("userId", "dedupKey");

-- CreateIndex
CREATE INDEX "CompanyPayout_paidAt_idx" ON "CompanyPayout"("paidAt");

-- CreateIndex
CREATE INDEX "CompanyPayout_forPeriod_idx" ON "CompanyPayout"("forPeriod");

-- CreateIndex
CREATE INDEX "CompanyPayout_kind_idx" ON "CompanyPayout"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPayout_userId_dedupKey_key" ON "CompanyPayout"("userId", "dedupKey");

-- CreateIndex
CREATE INDEX "Holding_userId_idx" ON "Holding"("userId");

-- CreateIndex
CREATE INDEX "Holding_source_idx" ON "Holding"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_userId_symbol_source_key" ON "Holding"("userId", "symbol", "source");

-- CreateIndex
CREATE INDEX "SavingsAccount_userId_idx" ON "SavingsAccount"("userId");

-- CreateIndex
CREATE INDEX "Chore_setId_day_position_idx" ON "Chore"("setId", "day", "position");

-- CreateIndex
CREATE INDEX "Chore_userId_idx" ON "Chore"("userId");

-- CreateIndex
CREATE INDEX "GratitudeItem_createdAt_idx" ON "GratitudeItem"("createdAt");

-- CreateIndex
CREATE INDEX "GratitudeItem_userId_idx" ON "GratitudeItem"("userId");

-- CreateIndex
CREATE INDEX "GratitudeReaction_itemId_idx" ON "GratitudeReaction"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "GratitudeReaction_itemId_person_key" ON "GratitudeReaction"("itemId", "person");

-- CreateIndex
CREATE INDEX "Supplement_timing_position_idx" ON "Supplement"("timing", "position");

-- CreateIndex
CREATE INDEX "Supplement_userId_idx" ON "Supplement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplement_userId_key_key" ON "Supplement"("userId", "key");

-- CreateIndex
CREATE INDEX "SupplementLog_day_idx" ON "SupplementLog"("day");

-- CreateIndex
CREATE INDEX "SupplementLog_userId_idx" ON "SupplementLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplementLog_userId_day_person_key_key" ON "SupplementLog"("userId", "day", "person", "key");

-- CreateIndex
CREATE INDEX "ImportBatch_userId_idx" ON "ImportBatch"("userId");

-- CreateIndex
CREATE INDEX "CategoryRule_userId_idx" ON "CategoryRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRule_userId_keyword_key" ON "CategoryRule"("userId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_credentialId_idx" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "Passkey"("userId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_efacturaCurrentId_fkey" FOREIGN KEY ("efacturaCurrentId") REFERENCES "EfacturaSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnafToken" ADD CONSTRAINT "AnafToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EfacturaSubmission" ADD CONSTRAINT "EfacturaSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPayment" ADD CONSTRAINT "TaxPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayout" ADD CONSTRAINT "CompanyPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreWeek" ADD CONSTRAINT "ChoreWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratitudeItem" ADD CONSTRAINT "GratitudeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratitudeReaction" ADD CONSTRAINT "GratitudeReaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GratitudeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplement" ADD CONSTRAINT "Supplement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementLog" ADD CONSTRAINT "SupplementLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


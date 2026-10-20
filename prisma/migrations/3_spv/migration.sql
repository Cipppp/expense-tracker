-- CreateTable
CREATE TABLE "SpvMessage" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "anafId" TEXT NOT NULL,
    "cif" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "anafCreatedAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT,
    "pdf" BYTEA,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpvMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpvMessage_userId_readAt_idx" ON "SpvMessage"("userId", "readAt");

-- CreateIndex
CREATE INDEX "SpvMessage_userId_anafCreatedAt_idx" ON "SpvMessage"("userId", "anafCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpvMessage_userId_anafId_key" ON "SpvMessage"("userId", "anafId");

-- AddForeignKey
ALTER TABLE "SpvMessage" ADD CONSTRAINT "SpvMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

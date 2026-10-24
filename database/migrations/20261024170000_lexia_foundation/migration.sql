-- CreateTable
CREATE TABLE "lexia_firms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalAiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedAiRegions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexia_firms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_members" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexia_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_clients" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "recordEncrypted" TEXT NOT NULL,
    "searchTokens" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lexia_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_matters" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reserved" BOOLEAN NOT NULL DEFAULT false,
    "filedAt" DATE,
    "normativeDate" DATE,
    "recordEncrypted" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lexia_matters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_matter_assignments" (
    "matterId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "capacity" TEXT NOT NULL DEFAULT 'collaborator',

    CONSTRAINT "lexia_matter_assignments_pkey" PRIMARY KEY ("matterId","memberId")
);

-- CreateTable
CREATE TABLE "lexia_documents" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'firm',
    "docType" TEXT,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "textEncrypted" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexia_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_deadlines" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATE,
    "status" TEXT NOT NULL,
    "basis" JSONB NOT NULL DEFAULT '{}',
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexia_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_tasks" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeId" TEXT,
    "dueDate" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexia_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_alerts" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexia_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexia_audit_log" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexia_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lexia_members_userId_idx" ON "lexia_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lexia_members_firmId_userId_key" ON "lexia_members"("firmId", "userId");

-- CreateIndex
CREATE INDEX "lexia_clients_firmId_archived_updatedAt_idx" ON "lexia_clients"("firmId", "archived", "updatedAt");

-- CreateIndex
CREATE INDEX "lexia_clients_searchTokens_idx" ON "lexia_clients" USING GIN ("searchTokens");

-- CreateIndex
CREATE INDEX "lexia_matters_firmId_status_updatedAt_idx" ON "lexia_matters"("firmId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "lexia_matters_clientId_idx" ON "lexia_matters"("clientId");

-- CreateIndex
CREATE INDEX "lexia_documents_firmId_matterId_idx" ON "lexia_documents"("firmId", "matterId");

-- CreateIndex
CREATE INDEX "lexia_deadlines_matterId_done_dueDate_idx" ON "lexia_deadlines"("matterId", "done", "dueDate");

-- CreateIndex
CREATE INDEX "lexia_tasks_matterId_done_idx" ON "lexia_tasks"("matterId", "done");

-- CreateIndex
CREATE INDEX "lexia_alerts_matterId_reviewStatus_idx" ON "lexia_alerts"("matterId", "reviewStatus");

-- CreateIndex
CREATE INDEX "lexia_audit_log_firmId_createdAt_idx" ON "lexia_audit_log"("firmId", "createdAt");

-- AddForeignKey
ALTER TABLE "lexia_members" ADD CONSTRAINT "lexia_members_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "lexia_firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_members" ADD CONSTRAINT "lexia_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_clients" ADD CONSTRAINT "lexia_clients_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "lexia_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_matters" ADD CONSTRAINT "lexia_matters_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "lexia_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_matters" ADD CONSTRAINT "lexia_matters_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "lexia_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_matter_assignments" ADD CONSTRAINT "lexia_matter_assignments_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "lexia_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_matter_assignments" ADD CONSTRAINT "lexia_matter_assignments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "lexia_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_documents" ADD CONSTRAINT "lexia_documents_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "lexia_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_documents" ADD CONSTRAINT "lexia_documents_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "lexia_matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_deadlines" ADD CONSTRAINT "lexia_deadlines_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "lexia_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_tasks" ADD CONSTRAINT "lexia_tasks_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "lexia_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_alerts" ADD CONSTRAINT "lexia_alerts_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "lexia_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lexia_audit_log" ADD CONSTRAINT "lexia_audit_log_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "lexia_firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;


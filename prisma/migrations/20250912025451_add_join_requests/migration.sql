-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventSlug" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "amountCents" INTEGER,
    "currency" TEXT,
    "method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedAt" DATETIME,
    "payoutReleased" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE INDEX "JoinRequest_eventSlug_idx" ON "JoinRequest"("eventSlug");

-- CreateIndex
CREATE INDEX "JoinRequest_memberEmail_idx" ON "JoinRequest"("memberEmail");

-- CreateIndex
CREATE INDEX "JoinRequest_groupName_idx" ON "JoinRequest"("groupName");

-- CreateIndex
CREATE INDEX "JoinRequest_eventSlug_groupName_memberEmail_idx" ON "JoinRequest"("eventSlug", "groupName", "memberEmail");

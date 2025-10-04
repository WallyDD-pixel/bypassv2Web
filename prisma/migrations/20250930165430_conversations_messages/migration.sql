-- CreateTable
CREATE TABLE "Conversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventSlug" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Conversation_eventSlug_idx" ON "Conversation"("eventSlug");

-- CreateIndex
CREATE INDEX "Conversation_groupName_idx" ON "Conversation"("groupName");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_eventSlug_groupName_key" ON "Conversation"("eventSlug", "groupName");

-- CreateIndex
CREATE INDEX "ConversationMember_userEmail_idx" ON "ConversationMember"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userEmail_key" ON "ConversationMember"("conversationId", "userEmail");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderEmail_idx" ON "Message"("senderEmail");

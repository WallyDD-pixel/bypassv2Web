-- DropIndex
DROP INDEX "Conversation_groupName_idx";

-- DropIndex
DROP INDEX "Conversation_eventSlug_idx";

-- DropIndex
DROP INDEX "Message_conversationId_createdAt_idx";

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

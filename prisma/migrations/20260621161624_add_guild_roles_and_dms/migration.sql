/*
  Warnings:

  - Added the required column `roleId` to the `GuildMember` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GuildMember" ADD COLUMN     "roleId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "GuildRole" (
    "id" UUID NOT NULL,
    "guildId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "permissions" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuildRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "groupId" UUID,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessageGroup" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessageGroupMember" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildRole_guildId_idx" ON "GuildRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildRole_guildId_name_key" ON "GuildRole"("guildId", "name");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_createdAt_idx" ON "DirectMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_groupId_createdAt_idx" ON "DirectMessage"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessageGroupMember_groupId_userId_key" ON "DirectMessageGroupMember"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "GuildRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildRole" ADD CONSTRAINT "GuildRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DirectMessageGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessageGroupMember" ADD CONSTRAINT "DirectMessageGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DirectMessageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessageGroupMember" ADD CONSTRAINT "DirectMessageGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

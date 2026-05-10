-- Alter Note.searchVector to tsvector type
ALTER TABLE "Note" ALTER COLUMN "searchVector" TYPE tsvector USING to_tsvector('simple', '');

-- FTS trigger function
CREATE OR REPLACE FUNCTION note_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FTS trigger
CREATE TRIGGER trg_note_search_vector
  BEFORE INSERT OR UPDATE ON "Note"
  FOR EACH ROW EXECUTE FUNCTION note_search_vector_update();

-- GIN index for FTS
CREATE INDEX IF NOT EXISTS idx_note_search_vector ON "Note" USING GIN("searchVector");

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_note_user_created ON "Note"("userId", "createdAt" DESC) WHERE "isDeleted" = false;
CREATE INDEX IF NOT EXISTS idx_note_public_created ON "Note"("isPublic", "createdAt" DESC) WHERE "isDeleted" = false;
CREATE INDEX IF NOT EXISTS idx_auditlog_user_time ON "AuditLog"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_auditlog_action ON "AuditLog"("actionType", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_user_level ON "User"(level DESC);
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email) WHERE "isBanned" = false;
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON "Notification"("userId", "createdAt" DESC) WHERE "isRead" = false;
CREATE INDEX IF NOT EXISTS idx_guildmessage_guild_time ON "GuildMessage"("guildId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_guildmember_guild ON "GuildMember"("guildId", "joinedAt");
CREATE INDEX IF NOT EXISTS idx_guildmember_user ON "GuildMember"("userId");

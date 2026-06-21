-- ============================================================================
-- FULL-TEXT SEARCH SETUP
-- ============================================================================
-- Run this script AFTER `prisma db push` or `prisma migrate deploy` to enable
-- PostgreSQL full-text search on the Note table.
--
-- Usage:
--   psql "$DATABASE_URL" -f prisma/fts-setup.sql
--   or: npx prisma db execute --file prisma/fts-setup.sql
--
-- Without this, the search endpoint falls back to ILIKE (slower, no ranking).
-- ============================================================================

-- Step 1: Alter Note.searchVector column type from TEXT (Prisma default) to tsvector
-- Populate existing rows immediately so they become searchable.
ALTER TABLE "Note" ALTER COLUMN "searchVector" TYPE tsvector USING (
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(content, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(category, '')), 'C')
);

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
DROP TRIGGER IF EXISTS trg_note_search_vector ON "Note";
CREATE TRIGGER trg_note_search_vector
  BEFORE INSERT OR UPDATE ON "Note"
  FOR EACH ROW EXECUTE FUNCTION note_search_vector_update();

-- GIN index for FTS
CREATE INDEX IF NOT EXISTS idx_note_search_vector ON "Note" USING GIN("searchVector");

-- Backfill any rows that might have been created while the trigger was missing.
UPDATE "Note" SET "searchVector" = (
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(content, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(category, '')), 'C')
) WHERE "searchVector" IS NULL OR "searchVector" = ''::tsvector;

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

import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { isBlockContent, parseBlocks, blockExcerpt } from "~/lib/blocks";
import { track } from "~/lib/analytics/tracker";

function makeExcerpt(content: string): string {
  return isBlockContent(content) ? blockExcerpt(parseBlocks(content)) : content.slice(0, 200);
}

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return error("VALIDATION_ERROR", "Search query too short", 400);
  }
  if (q.length > 200) {
    return error("VALIDATION_ERROR", "Search query too long", 400);
  }

  // Attempt full-text search first; fall back to ILIKE if FTS is unavailable.
  // Notes with JSON block content are still searchable because the raw JSON
  // string (which contains all block text as values) is stored in the
  // `content` column.  FTS matches against the JSON text directly, and the
  // ILIKE fallback likewise scans the column as plain text.
  try {
    type SearchRow = {
      id: string;
      title: string;
      content: string;
      category: string | null;
      tags: string[];
      isPublic: boolean;
      wordCount: number;
      createdAt: Date;
      updatedAt: Date;
      rank: number;
    };

    const results = await prisma.$queryRaw<SearchRow[]>`
      SELECT n.id, n.title, n.content, n.category, n.tags, n."isPublic",
             n."wordCount", n."createdAt", n."updatedAt",
             ts_rank(n."searchVector", query) AS rank
      FROM "Note" n, plainto_tsquery('english', ${q}) query
      WHERE n."searchVector" @@ query
        AND n."isDeleted" = false
        AND (n."isPublic" = true OR n."userId" = ${user.userId}::uuid)
      ORDER BY rank DESC
      LIMIT 30
    `;

    track({
      userId: user.userId,
      actionType: "note_search",
      metadata: { query: q, resultCount: results.length },
    });

    return success(
      results.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: makeExcerpt(n.content),
        category: n.category,
        tags: n.tags,
        isPublic: n.isPublic,
        wordCount: n.wordCount,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        rank: n.rank,
      }))
    );
  } catch (_ftsError) {
    const words = q.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return success([]);

    // $1 is the caller's userId (bound, never interpolated). Search terms are
    // $2..$(n+1), also bound. Nothing user-controlled is concatenated into SQL.
    const conditions = words.map((_word, i) => {
      const p = i + 2;
      return `(title ILIKE '%' || $${p} || '%' OR content ILIKE '%' || $${p} || '%')`;
    }).join('\n         AND ');

    const params = words.map(w => w.replace(/[%_]/g, '\\$&'));

    type FallbackRow = {
      id: string;
      title: string;
      content: string;
      category: string | null;
      tags: string[];
      isPublic: boolean;
      wordCount: number;
      createdAt: Date;
      updatedAt: Date;
    };

    const sql = `
      SELECT id, title, content, category, tags, "isPublic",
             "wordCount", "createdAt", "updatedAt"
      FROM "Note"
      WHERE "isDeleted" = false
        AND ("isPublic" = true OR "userId" = $1::uuid)
        AND (\n${conditions}\n)
      ORDER BY "updatedAt" DESC
      LIMIT 30
    `;

    const results = await prisma.$queryRawUnsafe<FallbackRow[]>(sql, user.userId, ...params);

    return success(
      results.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: makeExcerpt(n.content),
        category: n.category,
        tags: n.tags,
        isPublic: n.isPublic,
        wordCount: n.wordCount,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        rank: 0,
      }))
    );
  }
}

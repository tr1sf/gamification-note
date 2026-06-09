import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { getUserFromRequest } from "~/lib/auth/get-user";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q || q.length < 2) {
    return error("VALIDATION_ERROR", "Search query too short", 400);
  }

  // Attempt full-text search first; fall back to ILIKE if FTS is unavailable
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

    return success(
      results.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: n.content.slice(0, 200),
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
    const words = q.trim().split(/\s+/).filter(w => w.length > 0);
    const conditions = words.map((word, i) => {
      const clean = word.replace(/[%_]/g, '\\$&');
      return `(title ILIKE '%' || \$${i + 1} || '%' OR content ILIKE '%' || \$${i + 1} || '%')`;
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
        AND ("isPublic" = true OR "userId" = '${user.userId}'::uuid)
        AND (\n${conditions}\n)
      ORDER BY "updatedAt" DESC
      LIMIT 30
    `;

    const results = await prisma.$queryRawUnsafe<FallbackRow[]>(sql, ...params);

    return success(
      results.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: n.content.slice(0, 200),
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

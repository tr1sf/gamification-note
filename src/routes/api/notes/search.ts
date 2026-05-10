import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q || q.length < 2) {
    return error("VALIDATION_ERROR", "Search query too short", 400);
  }

  const results = await prisma.$queryRaw<Array<{ id: string; title: string; rank: number; createdAt: Date }>>`
    SELECT n.id, n.title, ts_rank(n."searchVector", query) AS rank, n."createdAt"
    FROM "Note" n, plainto_tsquery('simple', ${q}) query
    WHERE n."searchVector" @@ query
      AND n."isDeleted" = false
      AND (n."isPublic" = true OR n."userId" = ${user.userId}::uuid)
    ORDER BY rank DESC
    LIMIT 30
  `;

  return success(results);
}

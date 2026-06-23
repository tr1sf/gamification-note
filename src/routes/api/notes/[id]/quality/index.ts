import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { calculateStructureScore, scorePlainText, getImprovementTips } from "~/lib/analytics/quality-scorer";
import { isBlockContent, parseBlocks } from "~/lib/blocks";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const note = await prisma.note.findUnique({
    where: { id: params.id, isDeleted: false },
    select: { id: true, content: true, tags: true, category: true, userId: true, isPublic: true, wordCount: true },
  });

  if (!note) return error("NOT_FOUND", "Note not found", 404);
  if (note.userId !== user.userId && !note.isPublic) {
    return error("FORBIDDEN", "Not your note", 403);
  }

  const result = isBlockContent(note.content)
    ? calculateStructureScore(parseBlocks(note.content), note.tags, note.category)
    : scorePlainText(note.content, note.tags, note.category);

  const tier = result.score >= 13 ? "Outstanding" : result.score >= 9 ? "Excellent" : result.score >= 5 ? "Good" : result.score >= 3 ? "Fair" : "Needs Work";

  const improvements = getImprovementTips(result.breakdown);

  return success({
    score: result.score,
    maxScore: 15,
    tier,
    breakdown: {
      heading: result.breakdown.heading > 0,
      subheading: result.breakdown.subheading > 0,
      list: result.breakdown.list > 0,
      code: result.breakdown.code > 0,
      links: result.breakdown.links > 0,
      tagsCategory: result.breakdown.tagsCategory > 0,
      words50: result.breakdown.words50 > 0,
      words200: result.breakdown.words200 > 0,
      words500: result.breakdown.words500 > 0,
      vocabDiversity: result.breakdown.vocabDiversity,
      wordCount: result.metadata.wordCount,
    },
    improvements,
    minWordGate: result.breakdown.penalty < 0,
  });
}

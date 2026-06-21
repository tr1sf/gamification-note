import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { calculateStructureScore, scorePlainText } from "~/lib/analytics/quality-scorer";
import { isBlockContent, parseBlocks } from "~/lib/blocks";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const note = await prisma.note.findUnique({
    where: { id: params.id, isDeleted: false },
    select: { id: true, content: true, tags: true, category: true, userId: true, isPublic: true, wordCount: true },
  });

  if (!note) return error("NOT_FOUND", "Note not found", 404);
  // Only the owner or public note viewers can see quality score.
  if (note.userId !== user.userId && !note.isPublic) {
    return error("FORBIDDEN", "Not your note", 403);
  }

  // Compute structure score using the same scorer as gamification engine.
  let result;
  if (isBlockContent(note.content)) {
    const blocks = parseBlocks(note.content);
    result = calculateStructureScore(blocks, note.tags, note.category);
  } else {
    result = scorePlainText(note.content, note.tags, note.category);
  }

  // Build improvement suggestions based on what's missing.
  const suggestions: { text: string; points: number }[] = [];
  if (!result.metadata.hasH1) suggestions.push({ text: "Add a heading to structure your note", points: 1 });
  if (!result.metadata.hasH2) suggestions.push({ text: "Add a subheading for better organization", points: 1 });
  if (!result.metadata.hasList) suggestions.push({ text: "Use bullet or numbered lists", points: 1 });
  if (!result.metadata.hasCode && note.wordCount > 100) suggestions.push({ text: "Add code blocks if applicable", points: 1 });
  if (result.metadata.linkCount === 0) suggestions.push({ text: "Link to related resources", points: 1 });
  if (result.metadata.tagCount === 0) suggestions.push({ text: "Add tags for discoverability", points: 1 });
  if (!result.metadata.hasCategory) suggestions.push({ text: "Set a category", points: 1 });
  if (note.wordCount < 50) suggestions.push({ text: "Write more — aim for 50+ words", points: 1 });
  if (note.wordCount < 200) suggestions.push({ text: "Expand to 200+ words for depth", points: 1 });

  // Quality tier label.
  const tier = result.score >= 8 ? "Excellent" : result.score >= 6 ? "Good" : result.score >= 4 ? "Fair" : "Needs Work";

  return success({
    score: result.score,
    maxScore: 10,
    tier,
    breakdown: {
      hasH1: result.metadata.hasH1,
      hasH2: result.metadata.hasH2,
      hasList: result.metadata.hasList,
      hasCode: result.metadata.hasCode,
      linkCount: result.metadata.linkCount,
      tagCount: result.metadata.tagCount,
      hasCategory: result.metadata.hasCategory,
      wordCount: result.metadata.wordCount,
    },
    suggestions: suggestions.slice(0, 5), // top 5 most impactful
  });
}

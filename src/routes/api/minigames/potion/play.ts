import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { selectWords, getDifficultyForLevel, getThemeById, CATEGORY_NAMES, type DifficultyParams } from "~/lib/minigames/vocab";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const themeId = (body.theme as string) || "kitchen";
  const userLevel = Math.max(1, Number(body.level) || 1);

  const theme = getThemeById(themeId);
  if (!theme) return error("INVALID", "Unknown theme", 400);
  if (userLevel < theme.unlockLevel) return error("LOCKED", `Unlocked at level ${theme.unlockLevel}`, 403);

  const diff: DifficultyParams = getDifficultyForLevel(userLevel);

  // Check and consume a ticket
  const ticket = await prisma.userInventory.findFirst({
    where: { userId: user.userId, item: { name: "Alchemy Ticket" } },
    include: { item: true },
  });
  if (!ticket || ticket.quantity <= 0) return error("NO_TICKET", "You need an Alchemy Ticket to play. Buy one from the shop!", 400);

  if (ticket.quantity > 1) {
    await prisma.userInventory.update({
      where: { id: ticket.id },
      data: { quantity: { decrement: 1 } },
    });
  } else {
    await prisma.userInventory.delete({ where: { id: ticket.id } });
  }

  // Select words based on user level difficulty
  const pairs = selectWords(theme.category, diff.pairCount, diff.maxDifficulty);
  const actualPairCount = pairs.length;

  const cards = pairs.flatMap((p, i) => [
    { id: `emoji-${i}`, type: "emoji", display: p.emoji, pairId: i },
    { id: `word-${i}`, type: "word", display: p.word, pairId: i },
  ]);
  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  await prisma.auditLog.create({
    data: { userId: user.userId, actionType: "minigame_start", xpChange: 0, coinChange: 0, metadata: { game: "potion_match", category: theme.category, pairCount: actualPairCount, difficulty: diff.tier } },
  });

  return success({
    cards,
    pairCount: actualPairCount,
    category: theme.category,
    themeId: theme.id,
    categoryName: CATEGORY_NAMES[theme.category],
    difficulty: diff.tier,
    timeLimit: diff.timeLimit,
    rewardMultiplier: diff.rewardMultiplier,
  });
}

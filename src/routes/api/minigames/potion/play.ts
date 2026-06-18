import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { getPairsForGame, CATEGORY_NAMES } from "~/lib/minigames/vocab";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const category = (body.category as string) || "kitchen";
  const pairCount = category === "kitchen" ? 4 : 6;

  if (!CATEGORY_NAMES[category]) return error("INVALID", "Unknown category", 400);

  // Check and consume a ticket
  const ticket = await prisma.userInventory.findFirst({
    where: { userId: user.userId, item: { name: "Alchemy Ticket" } },
    include: { item: true },
  });
  if (!ticket) return error("NO_TICKET", "You need an Alchemy Ticket to play. Buy one from the shop!", 400);

  // Consume ticket
  await prisma.userInventory.delete({ where: { id: ticket.id } });

  // Generate cards
  const pairs = getPairsForGame(category, pairCount);
  const cards = pairs.flatMap((p, i) => [
    { id: `emoji-${i}`, type: "emoji", display: p.emoji, pairId: i },
    { id: `word-${i}`, type: "word", display: p.word, pairId: i },
  ]);
  // Shuffle cards
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  // Log game start
  await prisma.auditLog.create({
    data: { userId: user.userId, actionType: "minigame_start", xpChange: 0, coinChange: 0, metadata: { game: "potion_match", category, pairCount } },
  });

  return success({ cards, pairCount, category, categoryName: CATEGORY_NAMES[category] });
}

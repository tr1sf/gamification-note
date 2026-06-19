// Run: npx tsx scripts/verify-shop.ts
// Verifies shop item listing, purchase stacking, and Potion Match ticket consumption.

import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/jwt";

async function main() {
  console.log("🛒 Verifying shop and Potion Match ticket flow...\n");

  // 1. Find or create test user
  const email = "shop-checker@tavernotex.dev";
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.userInventory.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("🧹 Cleaned up previous shop-checker user");
  }

  const passwordHash = await hashPassword("test123456");
  user = await prisma.user.create({
    data: { email, username: "shopchecker", passwordHash, coins: 200 },
  });
  console.log(`👤 Created test user: ${user.username} (coins: ${user.coins})`);

  // 2. Verify shop listing logic (same filter as GET /api/shop)
  const ownedItemIds: string[] = [];
  const shopItems = await prisma.cosmeticItem.findMany({
    where: {
      isActive: true,
      OR: [
        { type: "consumable" },
        ownedItemIds.length > 0
          ? { type: { not: "consumable" }, id: { notIn: ownedItemIds } }
          : { type: { not: "consumable" } },
      ],
    },
    orderBy: { coinCost: "asc" },
  });

  const ticketInShop = shopItems.find((i) => i.name === "Alchemy Ticket");
  if (!ticketInShop) {
    console.error("❌ Alchemy Ticket NOT found in shop listing");
    process.exit(1);
  }
  console.log(`✅ Alchemy Ticket visible in shop: ${ticketInShop.coinCost} coins`);

  // 3. Simulate registration free tickets
  const ticketItem = await prisma.cosmeticItem.findFirst({
    where: { name: "Alchemy Ticket", type: "consumable" },
  });
  if (!ticketItem) {
    console.error("❌ Alchemy Ticket item not found");
    process.exit(1);
  }

  await prisma.userInventory.create({
    data: { userId: user.id, cosmeticItemId: ticketItem.id, quantity: 2 },
  });
  console.log("🎫 Granted 2 free Alchemy Tickets");

  // 4. Simulate purchasing a ticket (stacking)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { coins: { decrement: ticketItem.coinCost } } });
    await tx.userInventory.update({
      where: { userId_cosmeticItemId: { userId: user.id, cosmeticItemId: ticketItem.id } },
      data: { quantity: { increment: 1 } },
    });
  });
  console.log(`💰 Purchased 1 Alchemy Ticket (+1 quantity)`);

  // 5. Verify quantity
  const inventory = await prisma.userInventory.findUnique({
    where: { userId_cosmeticItemId: { userId: user.id, cosmeticItemId: ticketItem.id } },
  });
  if (!inventory || inventory.quantity !== 3) {
    console.error(`❌ Expected quantity 3, got ${inventory?.quantity ?? 0}`);
    process.exit(1);
  }
  console.log(`✅ Ticket quantity after purchase: ${inventory.quantity}`);

  // 6. Simulate playing Potion Match (consume 1)
  if (inventory.quantity > 1) {
    await prisma.userInventory.update({
      where: { id: inventory.id },
      data: { quantity: { decrement: 1 } },
    });
  } else {
    await prisma.userInventory.delete({ where: { id: inventory.id } });
  }

  const afterPlay = await prisma.userInventory.findUnique({
    where: { userId_cosmeticItemId: { userId: user.id, cosmeticItemId: ticketItem.id } },
  });
  if (!afterPlay || afterPlay.quantity !== 2) {
    console.error(`❌ Expected quantity 2 after play, got ${afterPlay?.quantity ?? 0}`);
    process.exit(1);
  }
  console.log(`✅ Ticket quantity after playing: ${afterPlay.quantity}`);

  // 7. Cleanup
  await prisma.userInventory.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("\n🧹 Cleaned up test user");
  console.log("✨ All shop/ticket checks passed!");
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});

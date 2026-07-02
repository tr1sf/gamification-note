import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

const ITEM_DEFS = [
  { name: "Alchemy Ticket", description: "Play Potion Match — match the emoji with its English word!", type: "consumable", coinCost: 15, rarity: "common", category: { usageType: "potion_ticket" } },
  { name: "XP Catalyst", description: "Doubles your daily XP cap for 24 hours. Use wisely — this is rare and powerful.", type: "consumable", coinCost: 80, rarity: "rare", category: { usageType: "xp_booster", durationHours: 24 } },
  { name: "Dragon Frame", description: "A fiery dragon wraps around your avatar", type: "avatar_frame", coinCost: 200, rarity: "legendary" },
  { name: "Starry Frame", description: "A constellation of stars adorns your profile", type: "avatar_frame", coinCost: 180, rarity: "epic" },
  { name: "Thorn Crown", description: "A crown of dark thorns — for the shadowy scribe", type: "avatar_frame", coinCost: 150, rarity: "rare" },
  { name: "Frost Frame", description: "An icy border that chills the air around your avatar", type: "avatar_frame", coinCost: 120, rarity: "rare" },
  { name: "Phoenix Quill", description: "A badge bearing the feather of a risen phoenix", type: "badge", coinCost: 100, rarity: "rare" },
  { name: "Moonlit Tome", description: "A tome that glows under the full moon — scholar endgame", type: "badge", coinCost: 80, rarity: "uncommon" },
  { name: "Ruby Ink", description: "Your name glows in deep ruby red", type: "name_color", coinCost: 100, rarity: "rare", category: { color: "#E0245E" } },
  { name: "Sapphire Ink", description: "Your name shines in royal sapphire blue", type: "name_color", coinCost: 100, rarity: "rare", category: { color: "#3B82F6" } },
  { name: "Golden Ink", description: "Your name gleams in liquid gold", type: "name_color", coinCost: 200, rarity: "epic", category: { color: "#F59E0B" } },
  { name: "Obsidian Frame", description: "A frame carved from the void itself — whispers included", type: "avatar_frame", coinCost: 250, rarity: "legendary" },
];

export async function POST() {
  try {
    let created = 0;
    let skipped = 0;
    const results: string[] = [];

    for (const def of ITEM_DEFS) {
      const exists = await prisma.cosmeticItem.findFirst({ where: { name: def.name }, select: { id: true } });
      if (exists) {
        skipped++;
        results.push(`SKIP: ${def.name} (already exists)`);
      } else {
        await prisma.cosmeticItem.create({ data: def as any });
        created++;
        results.push(`CREATED: ${def.name}`);
      }
    }

    return success({ created, skipped, total: ITEM_DEFS.length, results });
  } catch (e) {
    return error("SEED_ERROR", "Seed failed: " + (e as Error).message, 500);
  }
}

export async function GET() {
  return POST();
}

export interface EquippedCosmetics {
  avatarFrame?: {
    id: string;
    name: string;
    icon: string;
    rarity: string;
    imageUrl: string | null;
  };
  badge?: {
    id: string;
    name: string;
    icon: string;
    rarity: string;
    imageUrl: string | null;
  };
  nameColor?: {
    id: string;
    name: string;
    color: string | null;
    rarity: string;
  };
}

const rarityNameColors: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

function asColor(category: unknown): string | null {
  if (
    category &&
    typeof category === "object" &&
    "color" in category &&
    typeof (category as { color?: unknown }).color === "string"
  ) {
    return (category as { color: string }).color;
  }
  return null;
}

function itemIcon(imageUrl: string | null): string {
  return imageUrl && /^https?:\/\//.test(imageUrl) ? imageUrl : "🎁";
}

/**
 * Takes a Prisma `inventory` include (with `.item`) and returns only the
 * equipped badge, avatar frame, and name color in a shape the UI can render.
 */
export function getEquippedCosmetics(
  inventory: Array<{
    isEquipped: boolean;
    item: {
      id: string;
      name: string;
      type: string;
      rarity: string;
      imageUrl: string | null;
      category?: unknown;
    };
  }>
): EquippedCosmetics {
  const result: EquippedCosmetics = {};

  for (const inv of inventory) {
    if (!inv.isEquipped) continue;
    const { item } = inv;
    if (item.type === "badge") {
      result.badge = {
        id: item.id,
        name: item.name,
        icon: itemIcon(item.imageUrl),
        rarity: item.rarity,
        imageUrl: item.imageUrl,
      };
    } else if (item.type === "avatar_frame") {
      result.avatarFrame = {
        id: item.id,
        name: item.name,
        icon: itemIcon(item.imageUrl),
        rarity: item.rarity,
        imageUrl: item.imageUrl,
      };
    } else if (item.type === "name_color") {
      result.nameColor = {
        id: item.id,
        name: item.name,
        color: asColor(item.category) || rarityNameColors[item.rarity] || null,
        rarity: item.rarity,
      };
    }
  }

  return result;
}

import { Show, createMemo, createSignal } from "solid-js";
import { gamification, xpProgressInLevel } from "~/stores/user";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { t } from "~/lib/i18n";
import XPBar from "~/components/gamification/XPBar";
import DailyRewardBar from "~/components/gamification/DailyRewardBar";
import CoinDisplay from "~/components/gamification/CoinDisplay";
import StreakTracker from "~/components/gamification/StreakTracker";
import type { InventoryItem } from "./InventoryPanel";
import CosmeticAvatar, { CosmeticName } from "~/components/cosmetics/CosmeticAvatar";

interface CharacterSheetProps {
  username: string;
  avatarUrl: string | null;
  userPath?: string | null;
  inventory?: InventoryItem[];
}

const rarityNameColors: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

/** Check if an icon string is actually an image URL (not an emoji). */
function isImageUrl(icon: string | undefined): boolean {
  if (!icon) return false;
  return icon.startsWith("/assets/") || icon.startsWith("http");
}

/** Render an icon — as <img> if it's a URL, as text if it's an emoji. */
function renderIcon(icon: string | undefined) {
  if (!icon) return null;
  if (isImageUrl(icon)) {
    return <img src={icon} alt="" class="w-4 h-4 object-contain rounded" />;
  }
  return <span>{icon}</span>;
}

export default function CharacterSheet(props: CharacterSheetProps) {
  const g = () => gamification();
  const xpProgress = () => xpProgressInLevel(g().xp, g().level);

  const equippedCosmetics = createMemo(() => {
    const inv = props.inventory || [];
    const badgeItem = inv.find((i) => i.itemType === "badge" && i.equipped);
    const frameItem = inv.find((i) => i.itemType === "avatar_frame" && i.equipped);
    const colorItem = inv.find((i) => i.itemType === "name_color" && i.equipped);

    return {
      badge: badgeItem
        ? {
            id: badgeItem.id,
            name: badgeItem.name,
            icon: badgeItem.icon,
            rarity: badgeItem.rarity,
            imageUrl: isImageUrl(badgeItem.icon) ? badgeItem.icon : null,
          }
        : undefined,
      avatarFrame: frameItem
        ? {
            id: frameItem.id,
            name: frameItem.name,
            icon: frameItem.icon,
            rarity: frameItem.rarity,
            imageUrl: isImageUrl(frameItem.icon) ? frameItem.icon : null,
          }
        : undefined,
      nameColor: colorItem
        ? {
            id: colorItem.id,
            name: colorItem.name,
            color: colorItem.itemCategory?.color || rarityNameColors[colorItem.rarity] || null,
            rarity: colorItem.rarity,
          }
        : undefined,
    };
  });

  const equippedBadge = createMemo(() => equippedCosmetics().badge);

  const [uploading, setUploading] = createSignal(false);
  let fileInput: HTMLInputElement | undefined;

  const handleUpload = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await authFetch("/api/users/avatar", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success) { addToast(t("Avatar updated!"), "success"); location.reload(); }
      else addToast(json.error?.message || t("Upload failed"), "error");
    } catch { addToast(t("Upload failed"), "error"); }
    setUploading(false);
  };

  const pathDefaultAvatar = () => {
    if (props.avatarUrl) return null;
    // Fallback to text initial — could be path-specific images later
    return null;
  };

  return (
    <div class="p-4 sm:p-6 rounded-xl border border-surface-border bg-surface-elevated">
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div class="relative shrink-0 group cursor-pointer" onClick={() => fileInput?.click()} title="Click to change avatar">
          <CosmeticAvatar
            username={props.username}
            avatarUrl={props.avatarUrl}
            equipped={equippedCosmetics()}
            size="lg"
          />
          {uploading() && (
            <div class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <span class="text-white text-xs">{t("Uploading...")}</span>
            </div>
          )}
          <div class="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <span class="text-white text-xl">📷</span>
          </div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" class="hidden" onChange={handleUpload} />
          <div
            class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-surface-overlay text-xs font-bold flex items-center justify-center border-2 border-surface-elevated"
            aria-label={`Level ${g().level}`}
          >
            {g().level}
          </div>
        </div>

        <div class="flex-1 min-w-0 text-center sm:text-left">
          <div class="flex items-center justify-center sm:justify-start gap-2">
            <CosmeticName
              username={props.username}
              equipped={equippedCosmetics()}
              class="text-xl font-display font-bold truncate"
            />
            <Show when={equippedBadge()}>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm bg-surface border border-surface-border shadow-sm"
                title={equippedBadge()!.name}
              >
                {renderIcon(equippedBadge()!.icon)}
                <span class="text-xs text-ink-secondary hidden sm:inline">{equippedBadge()!.name}</span>
              </span>
            </Show>
          </div>
          <p class="text-sm text-accent font-semibold">{g().title}</p>
          <p class="text-xs text-ink-secondary mt-0.5">{t("No Guild")}</p>

          <div class="flex items-center justify-center sm:justify-start gap-4 mt-3">
            <CoinDisplay coins={g().coins} />
            <StreakTracker streak={g().streak} compact />
          </div>

          <div class="mt-3">
            <XPBar xp={g().xp} level={g().level} />
          </div>

          <div class="mt-2">
            <DailyRewardBar />
          </div>

          <p class="text-xs text-ink-secondary mt-2">
            {xpProgress().current.toLocaleString()} {t("XP to next level")}
          </p>
        </div>
      </div>
    </div>
  );
}

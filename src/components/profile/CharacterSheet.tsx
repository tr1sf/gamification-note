import { Show, createMemo } from "solid-js";
import { gamification, xpProgressInLevel } from "~/stores/user";
import XPBar from "~/components/gamification/XPBar";
import CoinDisplay from "~/components/gamification/CoinDisplay";
import StreakTracker from "~/components/gamification/StreakTracker";
import type { InventoryItem } from "./InventoryPanel";

interface CharacterSheetProps {
  username: string;
  avatarUrl: string | null;
  inventory?: InventoryItem[];
}

const frameBorders: Record<string, string> = {
  common: "border-ink-secondary/30",
  uncommon: "border-green-500/50",
  rare: "border-blue-500/50",
  epic: "border-purple-500/50",
  legendary: "border-coin/50",
};

export default function CharacterSheet(props: CharacterSheetProps) {
  const g = () => gamification();
  const xpProgress = () => xpProgressInLevel(g().xp, g().level);

  const equippedFrame = createMemo(() =>
    props.inventory?.find((i) => i.itemType === "avatar_frame" && i.equipped)
  );
  const equippedBadge = createMemo(() =>
    props.inventory?.find((i) => i.itemType === "badge" && i.equipped)
  );
  const equippedNameColor = createMemo(() =>
    props.inventory?.find((i) => i.itemType === "name_color" && i.equipped)
  );

  const avatarBorderClass = createMemo(() => {
    const frame = equippedFrame();
    if (!frame) return "border-surface-elevated";
    return frameBorders[frame.rarity] || "border-ink-secondary/30";
  });

  const nameStyle = createMemo(() => {
    const nc = equippedNameColor();
    if (!nc) return {};
    return { color: nc.rarity === "legendary" ? "var(--color-coin)" : undefined };
  });

  return (
    <div class="p-6 rounded-xl border border-surface-border bg-surface-elevated">
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div class="relative shrink-0">
          <div
            class={`w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-3xl font-bold text-accent overflow-hidden border-[3px] ${avatarBorderClass()}`}
          >
            <Show
              when={props.avatarUrl}
              fallback={
                <span aria-label={props.username}>
                  {props.username.charAt(0).toUpperCase()}
                </span>
              }
            >
              <img src={props.avatarUrl!} alt={props.username} class="w-full h-full object-cover" />
            </Show>
          </div>
          <div
            class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-surface-overlay text-xs font-bold flex items-center justify-center border-2 border-surface-elevated"
            aria-label={`Level ${g().level}`}
          >
            {g().level}
          </div>
        </div>

        <div class="flex-1 min-w-0 text-center sm:text-left">
          <div class="flex items-center justify-center sm:justify-start gap-2">
            <h2 class="text-xl font-display font-bold text-ink-primary truncate" style={nameStyle()}>
              {props.username}
            </h2>
            <Show when={equippedBadge()}>
              <span class="text-lg" title={equippedBadge()!.name}>{equippedBadge()!.icon}</span>
            </Show>
          </div>
          <p class="text-sm text-accent font-semibold">{g().title}</p>
          <p class="text-xs text-ink-secondary mt-0.5">No Guild</p>

          <div class="flex items-center justify-center sm:justify-start gap-4 mt-3">
            <CoinDisplay coins={g().coins} />
            <StreakTracker streak={g().streak} compact />
          </div>

          <div class="mt-3">
            <XPBar xp={g().xp} level={g().level} />
          </div>

          <p class="text-xs text-ink-secondary mt-2">
            {xpProgress().current.toLocaleString()} XP to next level
          </p>
        </div>
      </div>
    </div>
  );
}

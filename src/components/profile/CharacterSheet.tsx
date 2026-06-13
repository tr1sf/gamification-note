import { Show } from "solid-js";
import { gamification, xpProgressInLevel } from "~/stores/user";
import XPBar from "~/components/gamification/XPBar";
import CoinDisplay from "~/components/gamification/CoinDisplay";
import StreakTracker from "~/components/gamification/StreakTracker";

interface CharacterSheetProps {
  username: string;
  avatarUrl: string | null;
}

export default function CharacterSheet(props: CharacterSheetProps) {
  const g = () => gamification();
  const xpProgress = () => xpProgressInLevel(g().xp, g().level);

  return (
    <div class="p-6 rounded-xl border border-surface-border bg-surface-elevated">
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div class="relative shrink-0">
          <div class="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-3xl font-bold text-accent overflow-hidden">
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
          <h2 class="text-xl font-display font-bold text-ink-primary truncate">{props.username}</h2>
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

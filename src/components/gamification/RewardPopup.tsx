import { For, Show, createEffect } from "solid-js";
import { rewardQueue } from "~/stores/ui";
import { playSound } from "~/lib/sound";

export default function RewardPopup() {
  // Play sound when a new reward is added to the queue.
  createEffect(() => {
    const queue = rewardQueue();
    if (queue.length === 0) return;
    const latest = queue[queue.length - 1];
    if (latest.leveledUp) {
      playSound("levelUp");
    } else if (latest.achievement) {
      playSound("achievement");
    } else if ((latest.coins ?? 0) > 0) {
      playSound("coin");
    } else if ((latest.xp ?? 0) > 0) {
      playSound("xp");
    }
  });

  return (
    <div class="fixed top-16 right-4 z-50 space-y-2 pointer-events-none" aria-live="polite" role="status">
      <For each={rewardQueue()}>
        {(reward) => (
          <div
            class="flex flex-col gap-1 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto"
            style={{
              background: "var(--color-surface-elevated)",
              color: "var(--color-ink-primary)",
              animation: "slide-in 0.4s ease-out",
              border: "1px solid var(--color-surface-border)",
            }}
          >
            <Show when={reward.message}>
              <p class="text-ink-primary text-sm leading-relaxed">{reward.message}</p>
            </Show>
            <Show when={reward.achievement}>
              <div class="flex items-center gap-2">
                <span class="text-xl">🏆</span>
                <span>Achievement Unlocked!</span>
              </div>
              <span class="font-bold text-sm pl-8">{reward.achievement}</span>
            </Show>
            <Show when={reward.leveledUp}>
              <div class="flex items-center gap-2">
                <span class="text-xl">🎉</span>
                <span>Level Up! <span class="font-bold text-accent">Lv.{reward.newLevel}</span></span>
              </div>
              <Show when={reward.newTitle}>
                <span class="font-bold text-sm pl-8">{reward.newTitle}</span>
              </Show>
            </Show>
            <div class="flex items-center gap-3">
              <Show when={(reward.xp ?? 0) > 0}>
                <span class="flex items-center gap-1 text-xp">
                  <span>+{reward.xp} XP</span>
                  <span class="text-xs">🟢</span>
                </span>
              </Show>
              <Show when={(reward.coins ?? 0) > 0}>
                <span class="flex items-center gap-1 text-coin">
                  <span>+{reward.coins} Coins</span>
                  <span class="text-xs">🪙</span>
                </span>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

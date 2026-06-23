import { createSignal, onMount, Show } from "solid-js";
import { authFetch } from "~/stores/auth";
import { applyReward } from "~/stores/user";
import { showReward } from "~/stores/ui";

export default function DailyCheckin() {
  const [claimed, setClaimed] = createSignal(false);
  const [claiming, setClaiming] = createSignal(false);
  const [reward, setReward] = createSignal<{ xp: number; coins: number } | null>(null);
  const [streak, setStreak] = createSignal(0);

  onMount(async () => {
    const res = await authFetch("/api/auth/checkin", { method: "GET" });
    const json = await res.json();
    if (json.data?.claimed) {
      setClaimed(true);
      setReward({ xp: json.data.xpGained ?? 0, coins: json.data.coinsGained ?? 0 });
      setStreak(json.data.streak ?? 0);
    } else {
      setStreak(json.data?.streak ?? 0);
    }
  });

  const handleClaim = async () => {
    setClaiming(true);
    const res = await authFetch("/api/auth/checkin", { method: "POST" });
    const json = await res.json();
    if (json.success) {
      setClaimed(true);
      const d = json.data;
      setReward({ xp: d.xpGained, coins: d.coinsGained });
      setStreak(d.streak);
      applyReward({
        xpGained: d.xpGained,
        coinsGained: d.coinsGained,
        leveledUp: d.leveledUp,
        newLevel: d.newLevel,
        newTitle: d.newTitle,
      });
      showReward({
        message: `Daily reward: +${d.xpGained} XP, +${d.coinsGained} coins`,
        xp: d.xpGained,
        coins: d.coinsGained,
      });
    }
    setClaiming(false);
  };

  return (
    <div class="bg-surface-elevated rounded-xl border border-surface-border p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-ink-primary">Daily Check-in</h3>
        <Show when={streak() > 0}>
          <span class="text-xs text-amber-400">🔥 {streak()} day streak</span>
        </Show>
      </div>

      <Show
        when={claimed()}
        fallback={
          <button
            onClick={handleClaim}
            disabled={claiming()}
            class="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
          >
            {claiming() ? "Claiming..." : "🎁 Claim Daily Reward"}
          </button>
        }
      >
        <div class="text-center py-3 rounded-lg bg-success/10 border border-success/20">
          <p class="text-success font-semibold text-sm">✓ Claimed today!</p>
          <Show when={reward()}>
            <p class="text-xs text-ink-secondary mt-0.5">
              +{reward()?.xp} XP · +{reward()?.coins} coins
            </p>
          </Show>
        </div>
      </Show>
    </div>
  );
}

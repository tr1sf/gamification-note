import { createSignal, Show, onCleanup } from "solid-js";
import { authFetch } from "~/stores/auth";
import { addToast, showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";

export default function FocusTimer() {
  const [running, setRunning] = createSignal(false);
  const [seconds, setSeconds] = createSignal(0);
  const [duration, setDuration] = createSignal(25);
  let interval: ReturnType<typeof setInterval> | null = null;

  const format = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const start = () => {
    setRunning(true);
    setSeconds(duration() * 60);
    interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          stop();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const stop = async () => {
    if (interval) clearInterval(interval);
    interval = null;
    setRunning(false);
    const elapsed = duration() * 60 - seconds();
    const minutes = Math.round(elapsed / 60);
    if (minutes < 5) return;

    const res = await authFetch("/api/focus", {
      method: "POST",
      body: JSON.stringify({ minutes }),
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (json.success) {
      applyReward({ xpGained: json.data.xp, coinsGained: json.data.coins, leveledUp: false });
      showReward({
        message: `Focus Sprint! ${minutes}min — +${json.data.xp} XP`,
        xp: json.data.xp,
        coins: json.data.coins,
      });
      if (json.data.sprintStreak >= 3) addToast("3x sprint streak — 2x XP!", "success");
    }
  };

  onCleanup(() => {
    if (interval) clearInterval(interval);
  });

  return (
    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
      <h3 class="text-sm font-semibold text-ink-primary mb-3">Focus Sprint</h3>
      <Show
        when={!running()}
        fallback={
          <div class="text-center">
            <p class="text-4xl font-mono font-bold text-ink-primary mb-4">{format(seconds())}</p>
            <button onClick={stop} class="px-6 py-2 bg-error/10 text-error rounded-lg font-medium hover:bg-error/20">
              Stop Sprint
            </button>
          </div>
        }
      >
        <div class="flex items-center gap-2 mb-4">
          {[15, 25, 45, 60].map((m) => (
            <button
              onClick={() => setDuration(m)}
              class={`px-3 py-1.5 rounded-lg text-sm ${
                duration() === m
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "bg-surface border-surface-border text-ink-secondary"
              }`}
            >
              {m}min
            </button>
          ))}
        </div>
        <button onClick={start} class="w-full py-2 bg-accent text-white rounded-lg font-medium">
          Start Focus Sprint
        </button>
      </Show>
    </div>
  );
}

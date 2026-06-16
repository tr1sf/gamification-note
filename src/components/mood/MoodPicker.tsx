import { createSignal, For, Show } from "solid-js";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";

const MOODS = ["😊", "😐", "😢", "😡", "😴", "🎉", "💪", "🧘"];

export default function MoodPicker() {
  const [selected, setSelected] = createSignal<string | null>(null);
  const [todayMood, setTodayMood] = createSignal<string | null>(null);

  if (typeof document !== "undefined") {
    authFetch("/api/mood?days=1").then((r) => r.json()).then((j) => {
      if (j.success && j.data.length > 0) setTodayMood(j.data[0].mood);
    });
  }

  const pick = async (mood: string) => {
    setSelected(mood);
    const res = await authFetch("/api/mood", {
      method: "POST",
      body: JSON.stringify({ mood }),
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (json.success) {
      setTodayMood(mood);
      if (mood === "🎉") addToast("Great mood today! +3 coins", "success");
    } else if (json.error?.code !== "ALREADY_CHECKED") {
      addToast("Failed to save mood", "error");
    }
    setSelected(null);
  };

  return (
    <div class="bg-surface-elevated rounded-xl p-4 border border-surface-border">
      <p class="text-sm font-medium text-ink-primary mb-3">How are you feeling?</p>
      <div class="flex gap-2 flex-wrap">
        <For each={MOODS}>
          {(mood) => (
            <button
              onClick={() => pick(mood)}
              disabled={!!todayMood() || selected() === mood}
              class={`text-2xl p-2 rounded-lg transition-all ${todayMood() === mood ? "bg-accent/20 ring-2 ring-accent/30" : "hover:bg-surface-hover"} ${selected() === mood ? "animate-pulse" : ""} ${todayMood() && todayMood() !== mood ? "opacity-40" : ""}`}
              title={mood}
            >
              {mood}
            </button>
          )}
        </For>
      </div>
      <Show when={todayMood()}>
        <p class="text-xs text-ink-secondary/60 mt-2">Today's mood saved ✨</p>
      </Show>
    </div>
  );
}

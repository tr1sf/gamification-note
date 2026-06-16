import { For } from "solid-js";
import { gamification } from "~/stores/user";

const PLANTS = ["🌱", "🌿", "🪴", "🌻", "🌷", "🌳", "🌸", "🏵️", "🌺", "💐"];

export default function GratitudeGarden() {
  const g = () => gamification();
  const streak = () => g().streak;
  const plantIndex = () => Math.min(Math.floor(streak() / 3), PLANTS.length - 1);

  return (
    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border text-center">
      <h3 class="text-sm font-semibold text-ink-primary mb-3">Gratitude Garden</h3>
      <p class="text-5xl mb-2">{PLANTS[plantIndex()]}</p>
      <p class="text-sm text-ink-secondary">{streak()} day streak</p>
      <p class="text-xs text-ink-secondary/60 mt-1">
        {streak() < 7 ? "Next 🌿 at 7 days" : streak() < 30 ? "Next 🌳 at 30 days" : "🌺 Full bloom!"}
      </p>
      <div class="flex justify-center gap-1 mt-3 text-lg">
        <For each={PLANTS.slice(0, plantIndex() + 1)}>
          {(p, i) => <span>{p}</span>}
        </For>
      </div>
    </div>
  );
}

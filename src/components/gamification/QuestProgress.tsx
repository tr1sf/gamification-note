import { Show } from "solid-js";
import type { Quest } from "~/stores/quests";

interface QuestProgressProps {
  quests: Quest[];
}

export default function QuestProgress(props: QuestProgressProps) {
  const activeCount = () => props.quests.filter((q) => q.status !== "claimed").length;
  const completedCount = () => props.quests.filter((q) => q.status === "completed").length;

  return (
    <div class="p-3 rounded-lg border border-surface-border bg-surface-elevated">
      <div class="flex items-center gap-2 mb-2">
        <span aria-hidden="true" class="text-sm">📋</span>
        <span class="text-xs font-semibold text-ink-primary">Active Quests</span>
      </div>
      <p class="text-lg font-bold text-ink-primary">
        {completedCount()}
        <span class="text-ink-secondary text-sm font-normal"> / {activeCount()} quests</span>
      </p>
      <Show when={completedCount() > 0}>
        <p class="text-xs text-success mt-0.5">
          {completedCount()} reward{completedCount() !== 1 ? "s" : ""} ready to claim!
        </p>
      </Show>
    </div>
  );
}

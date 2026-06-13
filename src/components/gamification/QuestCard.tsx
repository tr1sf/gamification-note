import { Show } from "solid-js";
import type { Quest } from "~/stores/quests";

interface QuestCardProps {
  quest: Quest;
  onClaim: (questId: string) => void;
  claiming?: boolean;
}

export default function QuestCard(props: QuestCardProps) {
  const q = () => props.quest;
  const status = () => q().status || "active";

  const progressPct = () => {
    if (!q().progress) return 0;
    const criteria = q().criteria;
    const target = criteria?.target ?? criteria?.count ?? 1;
    if (target <= 0) return 100;
    return Math.min(100, Math.round((q().progress!.current / target) * 100));
  };

  const isCompleted = () => status() === "completed";
  const isClaimed = () => status() === "claimed";

  return (
    <div
      class={`p-4 rounded-lg border transition-all ${
        isClaimed()
          ? "border-surface-border bg-surface opacity-50"
          : isCompleted()
          ? "border-success/30 bg-success-bg"
          : "border-surface-border bg-surface-elevated hover:shadow-sm"
      }`}
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl shrink-0 mt-0.5" aria-hidden="true">{q().icon || "📜"}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold text-ink-primary text-sm truncate">{q().title}</h3>
            <Show when={isClaimed()}>
              <span class="text-xs px-2 py-0.5 rounded-full bg-surface-border text-ink-secondary font-medium shrink-0">Claimed</span>
            </Show>
            <Show when={isCompleted()}>
              <span class="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium shrink-0 flex items-center gap-1">
                <span>✓</span> Complete
              </span>
            </Show>
          </div>
          <p class="text-xs text-ink-secondary mt-0.5 line-clamp-2">{q().description}</p>

          <div class="mt-3">
            <div class="flex items-center justify-between mb-1 text-xs">
              <span class="text-ink-secondary">
                Progress: {q().progress?.current ?? 0} / {q().criteria?.target ?? q().criteria?.count ?? "?"}
              </span>
              <span class="text-ink-secondary">{progressPct()}%</span>
            </div>
            <div class="h-1.5 bg-surface-border rounded-full overflow-hidden">
              <div
                class={`h-full rounded-full transition-all duration-500 ${
                  isCompleted() ? "bg-success" : "bg-accent"
                }`}
                style={{ width: `${progressPct()}%` }}
              />
            </div>
          </div>

          <div class="flex items-center justify-between mt-3">
            <div class="flex items-center gap-3 text-xs">
              <span class="flex items-center gap-1 text-xp font-semibold">
                <span>+{q().xpReward}</span>
                <span class="text-xs">🟢</span>
              </span>
              <span class="flex items-center gap-1 text-coin font-semibold">
                <span>+{q().coinReward}</span>
                <span class="text-xs">🪙</span>
              </span>
            </div>
            <Show when={isCompleted()}>
              <button
                onClick={() => props.onClaim(q().id)}
                disabled={props.claiming}
                class="px-3 py-1 bg-accent text-surface-overlay text-xs font-semibold rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {props.claiming ? "Claiming..." : "Claim Reward"}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

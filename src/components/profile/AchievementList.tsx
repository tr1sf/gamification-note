import { Show, For } from "solid-js";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

interface AchievementListProps {
  achievements: Achievement[];
}

export default function AchievementList(props: AchievementListProps) {
  return (
    <div class="p-6 rounded-xl border border-surface-border bg-surface-elevated">
      <h2 class="text-lg font-display font-bold text-ink-primary mb-4">Achievements</h2>
      <Show
        when={props.achievements.length > 0}
        fallback={
          <p class="text-sm text-ink-secondary py-4 text-center">No achievements yet</p>
        }
      >
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <For each={props.achievements}>
            {(achievement) => (
              <div
                class={`p-3 rounded-lg border text-center transition-all ${
                  achievement.unlocked
                    ? "border-accent/30 bg-accent/5"
                    : "border-surface-border bg-surface opacity-50"
                }`}
              >
                <span class="text-2xl" aria-hidden="true">
                  {achievement.unlocked ? achievement.icon : "🔒"}
                </span>
                <p class={`text-xs font-semibold mt-1 ${achievement.unlocked ? "text-ink-primary" : "text-ink-secondary"}`}>
                  {achievement.title}
                </p>
                <Show when={achievement.unlocked && achievement.unlockedAt}>
                  <p class="text-[10px] text-ink-secondary mt-0.5">
                    {new Date(achievement.unlockedAt!).toLocaleDateString()}
                  </p>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

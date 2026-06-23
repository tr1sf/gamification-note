import { createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";

interface DigestData {
  yesterday: { notesWritten: number; xpEarned: number; wordsWritten: number };
  today: {
    activeBosses: Array<{ id: string; bossName: string; bossEmoji: string; bossCurrentHp: number; bossMaxHp: number; bossType: string }>;
    suggestedQuests: Array<{ id: string; title: string; questType: string; icon: string; xpReward: number; coinReward: number }>;
    habits: Array<{ id: string; title: string; icon: string; streak: number; completedToday: boolean }>;
  };
  streak: number;
}

export default function DailyDigest() {
  const [data] = createResource(async (): Promise<DigestData | null> => {
    const res = await authFetch("/api/digest/today");
    const json = await res.json();
    return json.success ? json.data : null;
  });

  return (
    <Show when={data()}>
      <div class="bg-surface-elevated rounded-xl border border-surface-border p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-primary">Daily Digest</h3>
          <span class="text-xs text-ink-muted">🔥 {data()!.streak} day streak</span>
        </div>

        {/* Yesterday recap */}
        <div class="bg-surface/50 rounded-lg p-3 border border-surface-border">
          <p class="text-xs text-ink-muted mb-2">Yesterday's Recap</p>
          <div class="flex items-center gap-4 text-sm">
            <span class="text-ink-secondary">📝 {data()!.yesterday.notesWritten} notes</span>
            <span class="text-xp">⚡ +{data()!.yesterday.xpEarned} XP</span>
            <span class="text-ink-secondary">✍️ {data()!.yesterday.wordsWritten} words</span>
          </div>
        </div>

        {/* Active bosses */}
        <Show when={(data()!.today.activeBosses?.length ?? 0) > 0}>
          <div>
            <p class="text-xs text-ink-muted mb-1">Active Bosses</p>
            <For each={data()!.today.activeBosses}>
              {(boss) => (
                <A
                  href={`/boss/${boss.id}`}
                  class="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <span>{boss.bossEmoji}</span>
                  <span class="text-xs text-ink-primary flex-1">{boss.bossName}</span>
                  <span class="text-[10px] text-error">{boss.bossCurrentHp}/{boss.bossMaxHp} HP</span>
                </A>
              )}
            </For>
          </div>
        </Show>

        {/* Habits */}
        <Show when={(data()!.today.habits?.length ?? 0) > 0}>
          <div>
            <p class="text-xs text-ink-muted mb-1">Pending Rituals</p>
            <For each={data()!.today.habits.filter((h) => !h.completedToday).slice(0, 3)}>
              {(habit) => (
                <A
                  href="/habits"
                  class="flex items-center gap-2 py-1 px-2 rounded text-xs text-ink-secondary hover:text-ink-primary"
                >
                  <span>{habit.icon}</span>
                  <span>{habit.title}</span>
                  {habit.streak > 0 && <span class="text-amber-400">🔥{habit.streak}</span>}
                </A>
              )}
            </For>
          </div>
        </Show>

        {/* Suggested quests */}
        <Show when={(data()!.today.suggestedQuests?.length ?? 0) > 0}>
          <div>
            <p class="text-xs text-ink-muted mb-1">Suggested Quests</p>
            <For each={data()!.today.suggestedQuests.slice(0, 3)}>
              {(quest) => (
                <A
                  href="/quests"
                  class="flex items-center gap-2 py-1 px-2 rounded text-xs text-ink-secondary hover:text-ink-primary"
                >
                  <span>{quest.icon}</span>
                  <span class="flex-1">{quest.title}</span>
                  <span class="text-xp">+{quest.xpReward} XP</span>
                </A>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}

import { Show, For } from "solid-js";
import { quests, questsLoading, fetchActiveQuests, claimQuest } from "~/stores/quests";
import { showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";
import QuestCard from "./QuestCard";
import { createSignal, onMount } from "solid-js";

interface QuestBoardProps {
  limit?: number;
}

export default function QuestBoard(props: QuestBoardProps) {
  const [claimingId, setClaimingId] = createSignal<string | null>(null);

  onMount(() => {
    fetchActiveQuests();
  });

  const dailyQuests = () =>
    quests().filter((q) => q.questType === "daily").slice(0, props.limit);
  const weeklyQuests = () =>
    quests().filter((q) => q.questType === "weekly").slice(0, props.limit);

  const handleClaim = async (questId: string) => {
    setClaimingId(questId);
    const result = await claimQuest(questId);
    setClaimingId(null);
    if (result.success && result.data?.gamification) {
      applyReward(result.data.gamification);
      if (result.data.gamification.xpGained > 0 || result.data.gamification.coinsGained > 0) {
        showReward({
          xp: result.data.gamification.xpGained,
          coins: result.data.gamification.coinsGained,
          leveledUp: result.data.gamification.leveledUp,
          newLevel: result.data.gamification.newLevel,
          newTitle: result.data.gamification.newTitle,
        });
      }
    }
  };

  return (
    <div class="space-y-8">
      <Show
        when={!questsLoading()}
        fallback={
          <div class="space-y-6">
            <div class="space-y-3">
              <div class="h-5 bg-surface-border rounded w-32 animate-pulse" />
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="h-40 bg-surface-border rounded-lg animate-pulse" />
                <div class="h-40 bg-surface-border rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        }
      >
        <Show
          when={quests().length > 0}
          fallback={
            <div class="text-center py-12 text-ink-secondary">
              <p class="text-4xl mb-3">📜</p>
              <p>No quests available today</p>
            </div>
          }
        >
          <section>
            <h2 class="text-lg font-display font-bold text-ink-primary mb-3 flex items-center gap-2">
              <span aria-hidden="true">☀️</span> Daily Quests
            </h2>
            <Show
              when={dailyQuests().length > 0}
              fallback={
                <p class="text-sm text-ink-secondary py-4">No daily quests available</p>
              }
            >
              <div class="grid gap-3 sm:grid-cols-2">
                <For each={dailyQuests()}>
                  {(quest) => (
                    <QuestCard
                      quest={quest}
                      onClaim={handleClaim}
                      claiming={claimingId() === quest.id}
                    />
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section>
            <h2 class="text-lg font-display font-bold text-ink-primary mb-3 flex items-center gap-2">
              <span aria-hidden="true">📅</span> Weekly Quests
            </h2>
            <Show
              when={weeklyQuests().length > 0}
              fallback={
                <p class="text-sm text-ink-secondary py-4">No weekly quests available</p>
              }
            >
              <div class="grid gap-3 sm:grid-cols-2">
                <For each={weeklyQuests()}>
                  {(quest) => (
                    <QuestCard
                      quest={quest}
                      onClaim={handleClaim}
                      claiming={claimingId() === quest.id}
                    />
                  )}
                </For>
              </div>
            </Show>
          </section>
        </Show>
      </Show>
    </div>
  );
}

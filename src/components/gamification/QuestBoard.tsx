import { Show, For } from "solid-js";
import { quests, questsLoading, fetchActiveQuests, claimQuest } from "~/stores/quests";
import { showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";
import QuestCard from "./QuestCard";
import { createSignal, onMount } from "solid-js";

interface QuestBoardProps {
  limit?: number;
}

const QUEST_TABS = ["daily", "weekly", "monthly", "chains"] as const;

export default function QuestBoard(props: QuestBoardProps) {
  const [claimingId, setClaimingId] = createSignal<string | null>(null);
  const [tab, setTab] = createSignal<"daily" | "weekly" | "monthly" | "chains">("daily");
  const [claimingAll, setClaimingAll] = createSignal(false);

  onMount(() => {
    fetchActiveQuests();
  });

  const filteredQuests = () => {
    const all = quests();
    return all
      .filter((q) => q.questType === tab())
      .slice(0, props.limit);
  };

  const completedQuests = () =>
    quests().filter((q) => q.status === "completed");

  const handleClaim = async (questId: string) => {
    setClaimingId(questId);
    const result = await claimQuest(questId);
    setClaimingId(null);
    if (result.success && result.data?.gamification) {
      applyReward(result.data.gamification);
      if (result.data.gamification.xpGained > 0 || result.data.gamification.coinsGained > 0) {
        showReward({
          message: result.data.gamification.message,
          xp: result.data.gamification.xpGained,
          coins: result.data.gamification.coinsGained,
          leveledUp: result.data.gamification.leveledUp,
          newLevel: result.data.gamification.newLevel,
          newTitle: result.data.gamification.newTitle,
        });
      }
    }
  };

  const claimAll = async () => {
    setClaimingAll(true);
    const completed = completedQuests();
    let totalXp = 0;
    let totalCoins = 0;
    for (const q of completed) {
      const r = await claimQuest(q.questId);
      if (r.data?.gamification) {
        totalXp += r.data.gamification.xpGained;
        totalCoins += r.data.gamification.coinsGained;
      }
    }
    if (totalXp > 0 || totalCoins > 0) {
      applyReward({ xpGained: totalXp, coinsGained: totalCoins, leveledUp: false });
      showReward({
        xp: totalXp,
        coins: totalCoins,
        message: `Claimed ${completed.length} quests!`,
      });
    }
    setClaimingAll(false);
    fetchActiveQuests();
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
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex gap-1 bg-surface-elevated rounded-lg p-1 border border-surface-border w-fit">
              {QUEST_TABS.map((t) => (
                <button
                  onClick={() => setTab(t)}
                  class={`px-4 py-1.5 rounded-md text-sm capitalize font-medium transition-colors ${
                    tab() === t
                      ? "bg-accent text-white shadow-sm"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Show when={completedQuests().length > 1}>
              <button
                onClick={claimAll}
                disabled={claimingAll()}
                class="px-4 py-1.5 bg-success text-surface-overlay text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {claimingAll() ? "Claiming..." : `Claim All (${completedQuests().length})`}
              </button>
            </Show>
          </div>

          <section>
            <Show
              when={filteredQuests().length > 0}
              fallback={
                <p class="text-sm text-ink-secondary py-4">
                  No {tab()} quests available
                </p>
              }
            >
              <div class="grid gap-3 sm:grid-cols-2">
                <For each={filteredQuests()}>
                  {(quest) => (
                    <QuestCard
                      quest={quest}
                      quests={quests()}
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

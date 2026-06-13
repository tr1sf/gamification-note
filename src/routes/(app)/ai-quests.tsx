import { createResource, createSignal, For, Show } from "solid-js";
import { authFetch } from "~/stores/auth";
import { showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";

interface AIQuestItem {
  id: string;
  title: string;
  description: string;
  actionType: string;
  target: number;
  xpReward: number;
  coinReward: number;
  source: string;
  ruleId: string | null;
  reason: string | null;
  status: string;
}

async function fetchQuests(): Promise<AIQuestItem[]> {
  const res = await authFetch("/api/ai-quests");
  const json = await res.json();
  if (json.success) return json.data;
  return [];
}

async function generateQuests(): Promise<AIQuestItem[]> {
  const res = await authFetch("/api/ai-quests", { method: "POST" });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error?.message);
}

async function completeQuest(id: string): Promise<any> {
  const res = await authFetch(`/api/ai-quests/${id}/complete`, { method: "POST" });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error?.message);
}

async function declineQuest(id: string): Promise<void> {
  await authFetch(`/api/ai-quests/${id}/decline`, { method: "POST" });
}

const ACTION_LABELS: Record<string, string> = {
  create_note: "Create a note",
  review_note: "Review an old note",
  ai_summarize: "Use AI summarize",
  make_public: "Make a note public",
};

export default function AIQuestsPage() {
  const [quests, { refetch }] = createResource(fetchQuests);
  const [generating, setGenerating] = createSignal(false);
  const [completing, setCompleting] = createSignal<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateQuests();
      refetch();
    } catch (e: any) {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async (id: string) => {
    setCompleting(id);
    try {
      const result = await completeQuest(id);
      if (result.gamification) {
        applyReward(result.gamification);
        showReward({
          message: result.gamification.message,
          xp: result.gamification.xpGained,
          coins: result.gamification.coinsGained,
          leveledUp: result.gamification.leveledUp,
          newLevel: result.gamification.newLevel,
          newTitle: result.gamification.newTitle,
        });
      }
      refetch();
    } catch {
    } finally {
      setCompleting(null);
    }
  };

  const handleDecline = async (id: string) => {
    await declineQuest(id);
    refetch();
  };

  return (
    <div class="max-w-3xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">AI Quests</h1>
          <p class="text-sm text-ink-secondary mt-1">Personalized quests based on your writing habits</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating()}
          class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            generating()
              ? "bg-surface-border text-ink-secondary/50 cursor-not-allowed"
              : "bg-accent text-white hover:bg-accent/90"
          }`}
        >
          {generating() ? "Analyzing..." : "Generate New Quests"}
        </button>
      </div>

      <Show
        when={!quests.loading}
        fallback={
          <div class="space-y-3">
            {[1, 2].map(() => <div class="h-32 bg-surface-border rounded-xl animate-pulse" />)}
          </div>
        }
      >
        <Show
          when={(quests()?.length ?? 0) > 0}
          fallback={
            <div class="text-center py-16 text-ink-secondary">
              <p class="text-5xl mb-4">🎯</p>
              <p class="text-lg font-medium mb-2">No AI quests yet</p>
              <p class="text-sm mb-4">Click "Generate New Quests" to get personalized suggestions!</p>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={quests()}>
              {(quest) => (
                <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border hover:border-accent/20 transition-colors">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xl">
                        {quest.actionType === "create_note" ? "📜" : quest.actionType === "review_note" ? "🔍" : quest.actionType === "ai_summarize" ? "✨" : "🌍"}
                      </span>
                      <div>
                        <h3 class="font-semibold text-ink-primary">{quest.title}</h3>
                        <p class="text-sm text-ink-secondary mt-0.5">{quest.description}</p>
                      </div>
                    </div>
                  </div>

                  <Show when={quest.reason}>
                    <p class="text-xs text-ink-secondary/70 bg-surface rounded-lg p-2 mt-2">
                      💡 Why: {quest.reason}
                    </p>
                  </Show>

                  <div class="flex items-center gap-2 mt-3">
                    <span class="text-xs px-2 py-1 rounded bg-surface border border-surface-border text-ink-secondary">
                      {ACTION_LABELS[quest.actionType] || quest.actionType}
                    </span>
                    <span class="text-xs text-xp font-medium">+{quest.xpReward} XP</span>
                    <span class="text-xs text-coin font-medium">+{quest.coinReward} coins</span>

                    <div class="flex-1" />

                    <button
                      onClick={() => handleDecline(quest.id)}
                      class="text-xs text-ink-secondary/50 hover:text-ink-secondary px-2 py-1 rounded transition-colors"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handleComplete(quest.id)}
                      disabled={completing() === quest.id}
                      class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        completing() === quest.id
                          ? "bg-surface-border text-ink-secondary/50 cursor-not-allowed"
                          : "bg-accent text-white hover:bg-accent/90"
                      }`}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

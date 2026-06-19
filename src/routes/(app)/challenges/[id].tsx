import { createResource, createSignal, createEffect, For, Show } from "solid-js";
import { useParams, useNavigate, A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { showReward, addToast } from "~/stores/ui";
import { applyReward } from "~/stores/user";

interface ChallengeDetail {
  id: string;
  title: string;
  description: string | null;
  theme: string;
  difficulty: string;
  iconEmoji: string | null;
  targetProgress: number;
  currentProgress: number;
  status: string;
  rewardXp: number;
  rewardCoins: number;
  isPublic: boolean;
  createdAt: string;
  bossType: string | null;
  actions: ChallengeAction[];
}

interface ChallengeAction {
  id: string;
  title: string;
  description: string | null;
  iconEmoji: string | null;
  progressValue: number;
  order: number;
  linkedActionType: string | null;
  linkedTarget: number | null;
  linkedProgress: number;
  isRepeatable: boolean;
  maxRepeats: number | null;
  repeatCount: number;
  status: string;
}

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: "text-success bg-success/10 border-success/20",
  medium: "text-accent bg-accent/10 border-accent/20",
  hard: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  epic: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

async function fetchChallenge(id: string): Promise<ChallengeDetail> {
  const res = await authFetch(`/api/challenges/${id}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error?.message || "Failed to load challenge");
}

async function completeAction(challengeId: string, actionId: string): Promise<any> {
  const res = await authFetch(`/api/challenges/${challengeId}/actions/${actionId}/complete`, { method: "POST" });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error?.message || "Failed to complete action");
}

export default function ChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, { refetch }] = createResource(() => params.id, fetchChallenge);
  const [completing, setCompleting] = createSignal<string | null>(null);
  const [restarting, setRestarting] = createSignal(false);
  const [showCelebration, setShowCelebration] = createSignal(false);

  createEffect(() => {
    const c = challenge();
    if (c?.bossType && c?.status === "active") {
      navigate(`/boss/${c.id}`, { replace: true });
    }
  });

  const pct = () => {
    const c = challenge();
    if (!c) return 0;
    return Math.min(100, Math.round((c.currentProgress / c.targetProgress) * 100));
  };

  const isCompleted = () => challenge()?.status === "completed";

  const handleComplete = async (actionId: string) => {
    setCompleting(actionId);
    try {
      const result = await completeAction(params.id, actionId);
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
      if (result.challengeCompleted) {
        addToast("Challenge completed! 🎉", "success");
        setShowCelebration(true);
      }
      refetch();
    } catch (e: any) {
      addToast(e.message || "Failed to complete action", "error");
    } finally {
      setCompleting(null);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const res = await authFetch(`/api/challenges/${params.id}`, { method: "PATCH" });
      const json = await res.json();
      if (json.success) {
        addToast("Challenge restarted!", "success");
        navigate(`/challenges/${json.data.id}`);
      } else {
        addToast(json.error?.message || "Failed to restart", "error");
      }
    } catch {
      addToast("Failed to restart challenge", "error");
    } finally {
      setRestarting(false);
    }
  };

  createEffect(() => {
    if (challenge()?.status === "completed") {
      setShowCelebration(true);
    }
  });

  return (
    <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <A href="/challenges" class="text-sm text-ink-secondary hover:text-ink-primary transition-colors">
        ← Back to Challenges
      </A>

      <Show
        when={!challenge.loading && challenge()}
        fallback={
          <div class="space-y-4">
            <div class="h-8 w-64 bg-surface-border rounded animate-pulse" />
            <div class="h-4 w-96 bg-surface-border rounded animate-pulse" />
            <div class="h-4 bg-surface-border rounded animate-pulse mt-2" />
          </div>
        }
      >
        {(c) => (
          <>
            {/* Header */}
            <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border">
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                  <span class="text-3xl">{c().iconEmoji || "🎯"}</span>
                  <div>
                    <h1 class="text-xl font-display font-bold text-ink-primary">{c().title}</h1>
                    <Show when={c().description}>
                      <p class="text-sm text-ink-secondary mt-1">{c().description}</p>
                    </Show>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class={`text-xs px-2 py-1 rounded border font-medium ${DIFFICULTY_CLASSES[c().difficulty] || ""}`}>
                    {c().difficulty}
                  </span>
                  <Show when={isCompleted()}>
                    <span class="text-xs px-2 py-1 rounded border font-medium text-success bg-success/10 border-success/20">
                      Completed
                    </span>
                  </Show>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-ink-secondary font-medium">{pct()}% complete</span>
                  <span class="text-ink-secondary/60">{c().currentProgress}/{c().targetProgress}</span>
                </div>
                <div class="h-3 bg-surface-border rounded-full overflow-hidden">
                  <div
                    class="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${pct()}%` }}
                  />
                </div>
              </div>

              <div class="flex items-center gap-4 mt-4 text-sm">
                <span class="text-ink-secondary">
                  <span class="font-medium text-xp">+{c().rewardXp} XP</span> reward
                </span>
                <span class="text-ink-secondary">
                  <span class="font-medium text-coin">+{c().rewardCoins} coins</span> reward
                </span>
              </div>
            </div>

            {/* Actions */}
            <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border">
              <h3 class="text-sm font-semibold text-ink-primary mb-4">
                Actions ({c().actions.filter((a) => a.status === "completed").length}/{c().actions.length})
              </h3>
              <div class="space-y-2">
                <For each={c().actions}>
                  {(action) => (
                    <div
                      class={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        action.status === "completed" && !action.isRepeatable
                          ? "border-success/20 bg-success/5"
                          : "border-surface-border hover:border-surface-border/80"
                      }`}
                    >
                      <span class="text-xl shrink-0">
                        {action.status === "completed" && !action.isRepeatable ? "✅" : action.iconEmoji || "○"}
                      </span>
                      <div class="flex-1 min-w-0">
                        <p class={`text-sm font-medium ${action.status === "completed" && !action.isRepeatable ? "text-ink-secondary line-through" : "text-ink-primary"}`}>
                          {action.title}
                        </p>
                        <Show when={action.description}>
                          <p class="text-xs text-ink-secondary/70 mt-0.5">{action.description}</p>
                        </Show>
                        <div class="flex items-center gap-2 mt-1">
                          <span class="text-xs text-ink-secondary/50">{action.progressValue} pts</span>
                          <Show when={action.isRepeatable}>
                            <span class="text-xs text-ink-secondary/50">
                              {action.repeatCount}/{action.maxRepeats ?? "∞"}
                            </span>
                          </Show>
                          <Show when={action.linkedActionType}>
                            <span class="text-xs text-accent/70">linked: {action.linkedActionType}</span>
                          </Show>
                        </div>
                      </div>
                      <Show when={action.status !== "completed" || action.isRepeatable}>
                        <button
                          onClick={() => handleComplete(action.id)}
                          disabled={completing() === action.id}
                          class={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            completing() === action.id
                              ? "bg-surface-border text-ink-secondary/50 cursor-not-allowed"
                              : "bg-accent text-white hover:bg-accent/90"
                          }`}
                        >
                          {completing() === action.id ? "..." : "Complete"}
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Celebration Section */}
            <Show when={showCelebration() && isCompleted()}>
              <div class="bg-surface-elevated rounded-xl p-6 border border-success/20 bg-success/5 relative overflow-hidden">
                <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
                  <span class="absolute top-2 left-4 text-xl animate-celebration-bounce" style="animation-delay: 0s">🎉</span>
                  <span class="absolute top-4 right-6 text-xl animate-celebration-bounce" style="animation-delay: 0.2s">✨</span>
                  <span class="absolute bottom-4 left-8 text-xl animate-celebration-bounce" style="animation-delay: 0.4s">🌟</span>
                  <span class="absolute top-6 right-12 text-xl animate-celebration-bounce" style="animation-delay: 0.6s">💫</span>
                  <span class="absolute bottom-2 right-4 text-xl animate-celebration-bounce" style="animation-delay: 0.8s">⭐</span>
                </div>
                <div class="text-center space-y-3 relative z-10">
                  <div class="text-5xl animate-celebration-bounce">
                    {c().theme === "growth" ? "🌱" : c().theme === "journey" ? "🧭" : c().theme === "puzzle" ? "🧩" : c().theme === "star" ? "⭐" : c().theme === "museum" ? "🏛️" : c().theme === "scholar" ? "📚" : "🏆"}
                  </div>
                  <h2 class="text-xl font-display font-bold text-ink-primary">Challenge Complete!</h2>
                  <p class="text-sm text-ink-secondary">Congratulations on finishing "{c().title}"</p>
                  <div class="flex items-center justify-center gap-6 mt-3">
                    <div class="text-center">
                      <p class="text-2xl font-bold text-xp">+{c().rewardXp}</p>
                      <p class="text-xs text-ink-secondary/60">XP Earned</p>
                    </div>
                    <div class="text-center">
                      <p class="text-2xl font-bold text-coin">+{c().rewardCoins}</p>
                      <p class="text-xs text-ink-secondary/60">Coins Earned</p>
                    </div>
                  </div>
                  <div class="flex items-center justify-center gap-3 pt-2">
                    <A
                      href="/challenges/new"
                      class="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
                    >
                      Create Next Challenge
                    </A>
                    <button
                      onClick={handleRestart}
                      disabled={restarting()}
                      class={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        restarting()
                          ? "border-surface-border text-ink-secondary/50 cursor-not-allowed"
                          : "border-accent text-accent hover:bg-accent/10"
                      }`}
                    >
                      {restarting() ? "Restarting..." : "Restart"}
                    </button>
                  </div>
                </div>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}

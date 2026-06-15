import { createResource, createSignal, For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { applyReward, gamification } from "~/stores/user";
import { showReward } from "~/stores/ui";

interface ChallengeItem {
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
  _count: { actions: number };
  createdAt: string;
  bossType: string | null;
  bossName: string | null;
  bossEmoji: string | null;
  bossCurrentHp: number | null;
  bossMaxHp: number | null;
}

interface Template {
  id: string;
  title: string;
  description: string;
  theme: string;
  difficulty: string;
  iconEmoji: string | null;
  targetProgress: number;
  rewardXp: number;
  rewardCoins: number;
  defaultActions: any[];
  usageCount: number;
}

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: "text-success bg-success/10 border-success/20",
  medium: "text-accent bg-accent/10 border-accent/20",
  hard: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  epic: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const THEME_ICONS: Record<string, string> = {
  growth: "🌱",
  journey: "🧭",
  puzzle: "🧩",
  star: "⭐",
  museum: "🏛️",
  scholar: "📚",
};

async function fetchChallenges(status: string): Promise<ChallengeItem[]> {
  const res = await authFetch(`/api/challenges?status=${status}`);
  const json = await res.json();
  if (json.success) return json.data;
  return [];
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await authFetch("/api/challenges/templates");
  const json = await res.json();
  if (json.success) return json.data;
  return [];
}

async function createFromTemplate(templateId: string): Promise<any> {
  const res = await authFetch(`/api/challenges/templates/${templateId}/use`, { method: "POST" });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error?.message);
}

export default function ChallengeListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = createSignal("active");
  const [challenges, { refetch }] = createResource(tab, fetchChallenges);
  const [templates] = createResource(fetchTemplates);
  const [showTemplates, setShowTemplates] = createSignal(false);

  const pct = (challenge: ChallengeItem) =>
    Math.min(100, Math.round((challenge.currentProgress / challenge.targetProgress) * 100));

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      const challenge = await createFromTemplate(templateId);
      navigate(`/challenges/${challenge.id}`);
    } catch (e: any) {
      // ignore
    }
  };

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Challenges</h1>
          <p class="text-sm text-ink-secondary mt-1">Set goals and track your journey</p>
        </div>
        <div class="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates())}
            class="px-4 py-2 rounded-lg text-sm font-medium border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
          >
            {showTemplates() ? "Hide Templates" : "Templates"}
          </button>
          <A
            href="/challenges/new"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            + New Challenge
          </A>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex gap-1 bg-surface-elevated rounded-lg p-1 border border-surface-border w-fit">
        {["active", "completed", "paused", "archived"].map((t) => (
          <button
            onClick={() => setTab(t)}
            class={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab() === t ? "bg-accent text-white shadow-sm" : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Templates Panel */}
      <Show when={showTemplates() && !templates.loading}>
        <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
          <h3 class="text-sm font-semibold text-ink-primary mb-4">Quick Start Templates</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={templates()?.slice(0, 6)}>
              {(tpl) => (
                <button
                  onClick={() => handleCreateFromTemplate(tpl.id)}
                  class="text-left p-4 rounded-lg border border-surface-border hover:border-accent/30 hover:bg-surface-hover transition-all group"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">{tpl.iconEmoji || THEME_ICONS[tpl.theme] || "🎯"}</span>
                    <span class="text-sm font-semibold text-ink-primary group-hover:text-accent">{tpl.title}</span>
                  </div>
                  <p class="text-xs text-ink-secondary line-clamp-2">{tpl.description}</p>
                  <div class="flex items-center gap-2 mt-2">
                    <span class={`text-xs px-1.5 py-0.5 rounded border ${DIFFICULTY_CLASSES[tpl.difficulty] || ""}`}>
                      {tpl.difficulty}
                    </span>
                    <span class="text-xs text-ink-secondary/60">{tpl.usageCount} uses</span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Challenge Cards */}
      <Show
        when={!challenges.loading}
        fallback={
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(() => (
              <div class="h-36 bg-surface-border rounded-xl animate-pulse" />
            ))}
          </div>
        }
      >
        <Show
          when={(challenges()?.length ?? 0) > 0}
          fallback={
            <div class="text-center py-16 text-ink-secondary">
              <p class="text-5xl mb-4">🏆</p>
              <p class="text-lg font-medium mb-2">No {tab()} challenges</p>
              <p class="text-sm mb-4">Start a new challenge or use a template!</p>
              <A href="/challenges/new" class="text-accent hover:underline text-sm">Create your first challenge</A>
            </div>
          }
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <For each={challenges()}>
              {(challenge) => (
                challenge.bossType ? (
                  <A
                    href={`/boss/${challenge.id}`}
                    class="block bg-surface-elevated rounded-xl p-5 border border-surface-border hover:border-error/30 transition-all group"
                  >
                    <div class="flex items-start justify-between mb-3">
                      <div class="flex items-center gap-2">
                        <span class="text-2xl">{challenge.bossEmoji || "👻"}</span>
                        <div>
                          <h3 class="font-semibold text-ink-primary group-hover:text-error transition-colors">{challenge.bossName || challenge.title}</h3>
                          <p class="text-xs text-ink-secondary mt-0.5">{challenge.bossType === "daily" ? "Daily Minion" : challenge.bossType === "weekly" ? "Weekly Elite" : challenge.bossType}</p>
                        </div>
                      </div>
                      <span class={`text-xs px-1.5 py-0.5 rounded border ${challenge.status === "completed" ? "text-success bg-success/10 border-success/20" : "text-error bg-error/10 border-error/20"}`}>
                        {challenge.status === "completed" ? "Defeated" : challenge.bossType}
                      </span>
                    </div>
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-ink-secondary">HP</span>
                        <span class="text-ink-secondary/60">{challenge.bossCurrentHp}/{challenge.bossMaxHp}</span>
                      </div>
                      <div class="h-2 bg-surface-border rounded-full overflow-hidden">
                        <div
                          class={`h-full rounded-full transition-all duration-500 ${((challenge.bossCurrentHp ?? 0) / (challenge.bossMaxHp ?? 1)) < 0.2 ? "bg-error animate-pulse" : "bg-error"}`}
                          style={{ width: `${Math.round(((challenge.bossCurrentHp ?? 0) / (challenge.bossMaxHp ?? 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </A>
                ) : (
                  <A
                    href={`/challenges/${challenge.id}`}
                    class="block bg-surface-elevated rounded-xl p-5 border border-surface-border hover:border-accent/30 hover:shadow-md transition-all group"
                  >
                    <div class="flex items-start justify-between mb-3">
                      <div class="flex items-center gap-2">
                        <span class="text-2xl">{challenge.iconEmoji || THEME_ICONS[challenge.theme] || "🎯"}</span>
                        <div>
                          <h3 class="font-semibold text-ink-primary group-hover:text-accent transition-colors">{challenge.title}</h3>
                          <p class="text-xs text-ink-secondary mt-0.5">{challenge._count.actions} actions</p>
                        </div>
                      </div>
                      <span class={`text-xs px-1.5 py-0.5 rounded border ${DIFFICULTY_CLASSES[challenge.difficulty] || ""}`}>
                        {challenge.difficulty}
                      </span>
                    </div>

                    <Show when={challenge.description}>
                      <p class="text-sm text-ink-secondary mb-4 line-clamp-2">{challenge.description}</p>
                    </Show>

                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-ink-secondary">{pct(challenge)}%</span>
                        <span class="text-ink-secondary/60">{challenge.currentProgress}/{challenge.targetProgress}</span>
                      </div>
                      <div class="h-2 bg-surface-border rounded-full overflow-hidden">
                        <div
                          class="h-full bg-accent rounded-full transition-all duration-500"
                          style={{ width: `${pct(challenge)}%` }}
                        />
                      </div>
                    </div>

                    <div class="flex items-center gap-3 mt-3 text-xs text-ink-secondary/60">
                      <span>+{challenge.rewardXp} XP</span>
                      <span>+{challenge.rewardCoins} coins</span>
                    </div>
                  </A>
                )
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

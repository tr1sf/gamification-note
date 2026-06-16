import { createResource, createSignal, For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";

interface PublicChallenge {
  id: string;
  title: string;
  description: string | null;
  theme: string;
  difficulty: string;
  iconEmoji: string | null;
  targetProgress: number;
  rewardXp: number;
  rewardCoins: number;
  _count: { actions: number };
  user: { username: string; avatarUrl: string | null };
}

const THEMES = [
  { id: "growth", icon: "🌱", label: "Growth" },
  { id: "journey", icon: "🧭", label: "Journey" },
  { id: "puzzle", icon: "🧩", label: "Puzzle" },
  { id: "star", icon: "⭐", label: "Constellation" },
  { id: "museum", icon: "🏛️", label: "Museum" },
  { id: "scholar", icon: "📚", label: "Scholar" },
];

const DIFFICULTIES = ["easy", "medium", "hard", "epic"];

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: "text-success bg-success/10 border-success/20",
  medium: "text-accent bg-accent/10 border-accent/20",
  hard: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  epic: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

export default function PublicChallengesPage() {
  const navigate = useNavigate();
  const [themeFilter, setThemeFilter] = createSignal<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = createSignal<string | null>(null);

  const [challenges] = createResource(
    () => ({ theme: themeFilter(), difficulty: difficultyFilter() }),
    async (filters) => {
      const params = new URLSearchParams();
      if (filters.theme) params.set("theme", filters.theme);
      if (filters.difficulty) params.set("difficulty", filters.difficulty);
      params.set("take", "50");
      const res = await authFetch(`/api/challenges/public?${params.toString()}`);
      const json = await res.json();
      if (json.success) return json.data as PublicChallenge[];
      return [];
    }
  );

  const useTemplate = async (challengeId: string) => {
    try {
      const res = await authFetch(`/api/challenges/${challengeId}`);
      const json = await res.json();
      if (!json.success) {
        addToast("Failed to load challenge", "error");
        return;
      }
      const c = json.data;
      const createRes = await authFetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${c.title} (inspired)`,
          description: c.description,
          theme: c.theme,
          difficulty: c.difficulty,
          iconEmoji: c.iconEmoji,
          targetProgress: c.targetProgress,
          rewardXp: c.rewardXp,
          rewardCoins: c.rewardCoins,
          actions: (c.actions || []).map((a: any) => ({
            title: a.title,
            description: a.description,
            iconEmoji: a.iconEmoji,
            progressValue: a.progressValue,
            linkedActionType: a.linkedActionType,
            isRepeatable: a.isRepeatable,
            maxRepeats: a.maxRepeats,
          })),
        }),
      });
      const createJson = await createRes.json();
      if (createJson.success) {
        addToast("Challenge created from template!", "success");
        navigate(`/challenges/${createJson.data.id}`);
      } else {
        addToast(createJson.error?.message || "Failed to create", "error");
      }
    } catch {
      addToast("Failed to use template", "error");
    }
  };

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Public Challenges</h1>
          <p class="text-sm text-ink-secondary mt-1">Browse completed challenges shared by the community</p>
        </div>
        <A href="/challenges" class="text-sm text-ink-secondary hover:text-ink-primary transition-colors">
          ← My Challenges
        </A>
      </div>

      {/* Filters */}
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex flex-wrap gap-1">
          <button
            onClick={() => setThemeFilter(null)}
            class={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${themeFilter() === null ? "border-accent bg-accent/10 text-accent" : "border-surface-border text-ink-secondary hover:border-surface-border/80"}`}
          >
            All Themes
          </button>
          <For each={THEMES}>
            {(t) => (
              <button
                onClick={() => setThemeFilter(themeFilter() === t.id ? null : t.id)}
                class={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${themeFilter() === t.id ? "border-accent bg-accent/10 text-accent" : "border-surface-border text-ink-secondary hover:border-surface-border/80"}`}
              >
                {t.icon} {t.label}
              </button>
            )}
          </For>
        </div>
        <div class="flex gap-1">
          <button
            onClick={() => setDifficultyFilter(null)}
            class={`px-3 py-1 rounded-lg text-xs font-medium border capitalize transition-colors ${difficultyFilter() === null ? "border-accent bg-accent/10 text-accent" : "border-surface-border text-ink-secondary hover:border-surface-border/80"}`}
          >
            All
          </button>
          <For each={DIFFICULTIES}>
            {(d) => (
              <button
                onClick={() => setDifficultyFilter(difficultyFilter() === d ? null : d)}
                class={`px-3 py-1 rounded-lg text-xs font-medium border capitalize transition-colors ${difficultyFilter() === d ? "border-accent bg-accent/10 text-accent" : "border-surface-border text-ink-secondary hover:border-surface-border/80"}`}
              >
                {d}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Results */}
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
              <p class="text-5xl mb-4">🔍</p>
              <p class="text-lg font-medium mb-2">No public challenges found</p>
              <p class="text-sm">Try adjusting your filters</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <For each={challenges()}>
              {(challenge) => (
                <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border hover:border-accent/30 transition-all">
                  <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2">
                      <span class="text-2xl">{challenge.iconEmoji || "🎯"}</span>
                      <div>
                        <h3 class="font-semibold text-ink-primary">{challenge.title}</h3>
                        <p class="text-xs text-ink-secondary">by {challenge.user.username}</p>
                      </div>
                    </div>
                    <span class={`text-xs px-1.5 py-0.5 rounded border ${DIFFICULTY_CLASSES[challenge.difficulty] || ""}`}>
                      {challenge.difficulty}
                    </span>
                  </div>

                  <Show when={challenge.description}>
                    <p class="text-sm text-ink-secondary mb-4 line-clamp-2">{challenge.description}</p>
                  </Show>

                  <div class="flex items-center gap-3 text-xs text-ink-secondary/60 mb-3">
                    <span>+{challenge.rewardXp} XP</span>
                    <span>+{challenge.rewardCoins} coins</span>
                    <span>{challenge._count.actions} actions</span>
                  </div>

                  <button
                    onClick={() => useTemplate(challenge.id)}
                    class="w-full py-2 rounded-lg text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    Use this template
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

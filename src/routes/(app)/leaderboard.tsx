import { createResource, For, Show } from "solid-js";
import { authFetch, user } from "~/stores/auth";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  title: string;
  xp: number;
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (typeof document === "undefined") return []; // SSR — don't fetch
  const res = await authFetch("/api/leaderboard");
  const json = await res.json();
  if (json.success) return json.data || [];
  throw new Error(json.error?.message || "Failed to load leaderboard");
}

export default function LeaderboardPage() {
  const [data, { refetch }] = createResource(fetchLeaderboard);
  const currentUser = () => user();

  const rankMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${rank}`;
    }
  };

  return (
    <div class="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 class="text-2xl font-display font-bold text-ink-primary">Leaderboard</h1>
        <p class="text-sm text-ink-secondary mt-1">Top adventurers by XP</p>
      </div>

      <Show
        when={!data.loading}
        fallback={
          <div class="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div class="h-14 bg-surface-border rounded-lg animate-pulse" />
            ))}
          </div>
        }
      >
        <Show when={data.error}>
          <div class="text-center py-12">
            <p class="text-error mb-3">Failed to load leaderboard</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm">Try again</button>
          </div>
        </Show>

        <Show when={!data.error}>
          <Show
            when={(data()?.length ?? 0) > 0}
            fallback={
              <div class="text-center py-12 text-ink-secondary">
                <p class="text-4xl mb-3">🏆</p>
                <p>No adventurers on the leaderboard yet.</p>
              </div>
            }
          >
            <div class="rounded-lg border border-surface-border overflow-hidden">
              <div class="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center p-4 bg-surface-elevated border-b border-surface-border">
                <span class="text-xs font-medium text-ink-secondary w-10 text-center">Rank</span>
                <span class="text-xs font-medium text-ink-secondary">Adventurer</span>
                <span class="text-xs font-medium text-ink-secondary text-right">XP</span>
                <span class="text-xs font-medium text-ink-secondary text-right w-28">Level</span>
              </div>

              <For each={data()}>
                {(entry) => (
                  <div
                    class={`grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center p-4 border-b border-surface-border/50 last:border-b-0 ${
                      entry.userId === currentUser()?.id
                        ? "bg-accent/10"
                        : "hover:bg-surface-hover"
                    } transition-colors`}
                  >
                    <span class={`w-10 text-center font-mono font-bold ${
                      entry.rank <= 3 ? "text-xl" : "text-sm text-ink-secondary"
                    }`}>
                      {rankMedal(entry.rank)}
                    </span>

                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold shrink-0"
                        aria-label={entry.username}
                      >
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                      <div class="min-w-0">
                        <span class="text-sm font-medium text-ink-primary truncate block">
                          {entry.username}
                        </span>
                        <span class="text-xs text-ink-secondary truncate block">
                          {entry.title}
                        </span>
                      </div>
                    </div>

                    <span class="text-sm font-medium text-xp text-right font-mono">
                      {entry.xp.toLocaleString()}
                    </span>

                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20 justify-center w-28">
                      Lv.{entry.level}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

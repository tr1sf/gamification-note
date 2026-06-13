import { createResource, For, Show } from "solid-js";
import { authFetch } from "~/stores/auth";

interface InsightData {
  totalNotes: number;
  totalWords: number;
  avgWordsPerNote: number;
  avgNotesPerDay: number;
  currentStreak: number;
  longestStreak: number;
  mostProductiveDay: string;
  topTags: Array<{ tag: string; count: number }>;
  daysSinceJoined: number;
  thisWeek: { notes: number; words: number };
  lastWeek: { notes: number; words: number };
}

async function fetchInsights(): Promise<InsightData> {
  const res = await authFetch("/api/users/insights");
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error("Failed to load insights");
}

export default function InsightsPage() {
  const [data] = createResource(fetchInsights);

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 class="text-2xl font-display font-bold text-ink-primary">Knowledge Insights</h1>
        <p class="text-sm text-ink-secondary mt-1">Understand your writing patterns</p>
      </div>

      <Show
        when={!data.loading && data()}
        fallback={
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(() => <div class="h-28 bg-surface-border rounded-xl animate-pulse" />)}
          </div>
        }
      >
        {(d) => (
          <>
            {/* Top stats */}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Scrolls" value={d().totalNotes} icon="📜" />
              <StatCard label="Total Words" value={d().totalWords.toLocaleString()} icon="✍️" />
              <StatCard label="Words/Note Avg" value={d().avgWordsPerNote} icon="📏" />
              <StatCard label="Notes/Day Avg" value={d().avgNotesPerDay} icon="📊" />
            </div>

            {/* Week comparison */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                <h3 class="text-sm font-semibold text-ink-primary mb-3">This Week vs Last Week</h3>
                <div class="space-y-3">
                  <CompareRow label="Notes" curr={d().thisWeek.notes} prev={d().lastWeek.notes} />
                  <CompareRow label="Words" curr={d().thisWeek.words} prev={d().lastWeek.words} format />
                </div>
              </div>
              <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                <h3 class="text-sm font-semibold text-ink-primary mb-3">Your Rhythm</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-sm text-ink-secondary">Current Streak</span>
                    <span class="text-sm font-bold text-xp">{d().currentStreak} days 🔥</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink-secondary">Longest Streak</span>
                    <span class="text-sm font-medium text-ink-primary">{d().longestStreak} days</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink-secondary">Best Writing Day</span>
                    <span class="text-sm font-medium text-ink-primary">{d().mostProductiveDay}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink-secondary">Days Since Joined</span>
                    <span class="text-sm font-medium text-ink-primary">{d().daysSinceJoined}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Tags */}
            <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
              <h3 class="text-sm font-semibold text-ink-primary mb-4">Top Topics</h3>
              <Show
                when={d().topTags.length > 0}
                fallback={<p class="text-sm text-ink-secondary">Add tags to your notes to see topics</p>}
              >
                <div class="flex flex-wrap gap-2">
                  <For each={d().topTags}>
                    {(tag) => (
                      <span class="px-3 py-1.5 rounded-full text-sm bg-accent/10 text-accent border border-accent/20">
                        #{tag.tag} <span class="text-xs opacity-60">{tag.count}</span>
                      </span>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

function StatCard(props: { label: string; value: number | string; icon: string }) {
  return (
    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-lg">{props.icon}</span>
        <span class="text-xs text-ink-secondary uppercase tracking-wider font-semibold">{props.label}</span>
      </div>
      <p class="text-2xl font-bold text-ink-primary tabular-nums">{props.value}</p>
    </div>
  );
}

function CompareRow(props: { label: string; curr: number; prev: number; format?: boolean }) {
  const change = () => {
    if (props.prev === 0) return props.curr > 0 ? 100 : 0;
    return Math.round(((props.curr - props.prev) / props.prev) * 100);
  };
  const fmt = (v: number) => props.format ? v.toLocaleString() : v;

  return (
    <div class="flex items-center justify-between">
      <span class="text-sm text-ink-secondary">{props.label}</span>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-ink-primary">{fmt(props.curr)}</span>
        <span class={`text-xs ${change() >= 0 ? "text-success" : "text-error"}`}>
          {change() >= 0 ? "↗" : "↘"} {Math.abs(change())}%
        </span>
      </div>
    </div>
  );
}

import { createResource, createSignal, Show, For, Switch, Match } from "solid-js";
import { authFetch, user } from "~/stores/auth";

interface ProgressData {
  period: string;
  notes: number;
  notesLast: number;
  notesChange: number;
  words: number;
  wordsLast: number;
  wordsChange: number;
  reviews: number;
  reviewsLast: number;
  reviewsChange: number;
  dailyNotes: Array<{ date: string; count: number }>;
  bestDay: string;
  topTags: Array<{ tag: string; count: number }>;
  exports: number;
  questsCompleted: number;
  achievements: Array<{ title: string; icon: string; unlockedAt: string }>;
  totalNotes: number;
}

interface HeatmapData {
  days: number;
  data: Array<{ date: string; count: number; types: Record<string, number> }>;
  maxCount: number;
}

async function fetchProgress(period: string): Promise<ProgressData> {
  const res = await authFetch(`/api/users/progress?period=${period}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error?.message || "Failed to load progress");
}

async function fetchHeatmap(): Promise<HeatmapData> {
  const res = await authFetch("/api/users/progress/heatmap");
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error?.message || "Failed to load heatmap");
}

function intensityColor(count: number, max: number): string {
  if (count === 0) return "var(--color-surface-border)";
  const ratio = max > 0 ? count / max : 0;
  if (ratio <= 0.25) return "var(--color-accent)";
  if (ratio <= 0.5) return "var(--color-accent)";
  if (ratio <= 0.75) return "#d4a574";
  return "#e2b96f";
}

export default function ProgressPage() {
  const [period, setPeriod] = createSignal<"week" | "month">("week");
  const [progress, { refetch }] = createResource(period, fetchProgress);
  const [heatmap] = createResource(fetchHeatmap);

  const p = () => progress();

  const trendIcon = (change: number) => (change >= 0 ? "↗" : "↘");
  const trendColor = (change: number) => (change >= 0 ? "text-success" : "text-error");

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Your Progress</h1>
          <p class="text-sm text-ink-secondary mt-1">Personal journey, no comparison</p>
        </div>
        <div class="flex gap-1 bg-surface-elevated rounded-lg p-1 border border-surface-border">
          <button
            onClick={() => setPeriod("week")}
            class={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period() === "week" ? "bg-accent text-white shadow-sm" : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setPeriod("month")}
            class={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period() === "month" ? "bg-accent text-white shadow-sm" : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <Show
        when={!progress.loading && !progress.error}
        fallback={
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(() => (
              <div class="h-28 bg-surface-border rounded-xl animate-pulse" />
            ))}
          </div>
        }
      >
        {/* Stats Cards */}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label={`${period() === "week" ? "Weekly" : "Monthly"} Scrolls`}
            value={p()?.notes ?? 0}
            change={p()?.notesChange ?? 0}
            icon="📜"
          />
          <StatCard
            label="Words Written"
            value={p()?.words ?? 0}
            change={p()?.wordsChange ?? 0}
            icon="✍️"
            format
          />
          <StatCard
            label="Reviews Done"
            value={p()?.reviews ?? 0}
            change={p()?.reviewsChange ?? 0}
            icon="🔍"
          />
        </div>

        {/* Summary Cards */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
            <h3 class="text-sm font-semibold text-ink-primary mb-4">
              {period() === "week" ? "This Week" : "This Month"} Summary
            </h3>
            <div class="space-y-3">
              <SummaryRow label="Total Notes" value={`${p()?.totalNotes ?? 0} all time`} />
              <SummaryRow label="Best Day" value={`${p()?.bestDay ?? "-"}`} />
              <SummaryRow label="Quests Done" value={`${p()?.questsCompleted ?? 0}`} />
              <SummaryRow label="Exports" value={`${p()?.exports ?? 0}`} />
            </div>
          </div>

          <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
            <h3 class="text-sm font-semibold text-ink-primary mb-4">Top Tags</h3>
            <Show
              when={(p()?.topTags?.length ?? 0) > 0}
              fallback={<p class="text-sm text-ink-secondary">No tags yet</p>}
            >
              <div class="space-y-2">
                <For each={p()?.topTags}>
                  {(tag) => (
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-ink-primary">#{tag.tag}</span>
                      <span class="text-xs text-ink-secondary">{tag.count} notes</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Daily Activity */}
        <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
          <h3 class="text-sm font-semibold text-ink-primary mb-4">Daily Activity</h3>
          <Show
            when={(p()?.dailyNotes?.length ?? 0) > 0}
            fallback={<p class="text-sm text-ink-secondary">No activity this {period()}</p>}
          >
            <div class="flex items-end gap-1 h-32">
              <For each={p()?.dailyNotes}>
                {(day) => {
                  const maxDaily = Math.max(...(p()?.dailyNotes.map((d) => d.count) ?? [1]), 1);
                  const height = Math.max(4, (day.count / maxDaily) * 100);
                  return (
                    <div class="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.count} notes`}>
                      <div
                        class="w-full rounded-t-sm bg-accent/60 hover:bg-accent transition-colors"
                        style={{ height: `${height}%` }}
                      />
                      <span class="text-[0.6rem] text-ink-secondary/70">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* Streak Calendar */}
        <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
          <h3 class="text-sm font-semibold text-ink-primary mb-4">Activity Heatmap (90 days)</h3>
          <Show
            when={!heatmap.loading && (heatmap()?.data?.length ?? 0) > 0}
            fallback={<p class="text-sm text-ink-secondary">Loading...</p>}
          >
            <div class="flex flex-wrap gap-1">
              <For each={heatmap()?.data}>
                {(day) => (
                  <div
                    class="w-3 h-3 rounded-sm cursor-default"
                    style={{ background: intensityColor(day.count, heatmap()?.maxCount ?? 1) }}
                    title={`${day.date}: ${day.count} actions (notes: ${day.types.create_note ?? 0}, edits: ${day.types.note_edit ?? 0}, reviews: ${day.types.note_review ?? 0})`}
                  />
                )}
              </For>
            </div>
            <div class="flex items-center gap-2 mt-3 text-xs text-ink-secondary">
              <span>Less</span>
              <div class="w-3 h-3 rounded-sm" style={{ background: "var(--color-surface-border)" }} />
              <div class="w-3 h-3 rounded-sm" style={{ background: "var(--color-accent)" }} />
              <div class="w-3 h-3 rounded-sm" style={{ background: "#d4a574" }} />
              <div class="w-3 h-3 rounded-sm" style={{ background: "#e2b96f" }} />
              <span>More</span>
            </div>
          </Show>
        </div>

        {/* Recent Achievements */}
        <Show when={(p()?.achievements?.length ?? 0) > 0}>
          <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
            <h3 class="text-sm font-semibold text-ink-primary mb-4">Recent Achievements</h3>
            <div class="space-y-2">
              <For each={p()?.achievements}>
                {(ach) => (
                  <div class="flex items-center gap-3">
                    <span class="text-lg">🏆</span>
                    <div>
                      <p class="text-sm font-medium text-ink-primary">{ach.title}</p>
                      <p class="text-xs text-ink-secondary">{new Date(ach.unlockedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: number;
  change: number;
  icon: string;
  format?: boolean;
}) {
  return (
    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-lg">{props.icon}</span>
        <span class="text-xs text-ink-secondary uppercase tracking-wider font-semibold">{props.label}</span>
      </div>
      <p class="text-2xl font-bold text-ink-primary tabular-nums">
        {props.format ? props.value.toLocaleString() : props.value}
      </p>
      <p class={`text-xs mt-1 ${props.change >= 0 ? "text-success" : "text-error"}`}>
        {props.change >= 0 ? "↗" : "↘"} {Math.abs(props.change)}% vs last {props.label.includes("Week") ? "week" : "month"}
      </p>
    </div>
  );
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div class="flex items-center justify-between">
      <span class="text-sm text-ink-secondary">{props.label}</span>
      <span class="text-sm font-medium text-ink-primary">{props.value}</span>
    </div>
  );
}

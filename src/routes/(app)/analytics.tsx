import { createResource, Show, createSignal } from "solid-js";
import { authFetch } from "~/stores/auth";

async function fetchAnalytics(days: number) {
  const [overview, quizPerf, insights] = await Promise.all([
    authFetch(`/api/analytics/overview?days=${days}`).then(r => r.json()),
    authFetch("/api/analytics/quiz-performance").then(r => r.json()),
    authFetch("/api/analytics/learning-insights").then(r => r.json()),
  ]);
  return {
    overview: overview.success ? overview.data : null,
    quizPerformance: quizPerf.success ? quizPerf.data : null,
    insights: insights.success ? insights.data : null,
  };
}

export default function AnalyticsPage() {
  const [period, setPeriod] = createSignal(7);
  const [data] = createResource(period, fetchAnalytics);

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Learning Analytics</h1>
          <p class="text-sm text-ink-secondary mt-1">Your learning journey, quantified</p>
        </div>
        <div class="flex gap-1 bg-surface-elevated rounded-lg p-1 border border-surface-border">
          {[{ label: "7d", value: 7 }, { label: "30d", value: 30 }].map(p => (
            <button onClick={() => setPeriod(p.value)} class={`px-4 py-1.5 rounded-md text-sm font-medium ${period() === p.value ? "bg-accent text-white" : "text-ink-secondary"}`}>{p.label}</button>
          ))}
        </div>
      </div>

      <Show when={!data.loading && data()} fallback={
        <div class="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div class="h-24 bg-surface-border rounded-xl animate-pulse" />)}
        </div>
      }>
        {d => (
          <>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Notes" value={d().overview?.notes || 0} icon="📝" />
              <StatCard label="Quizzes" value={d().overview?.quizAttempts || 0} icon="🧠" />
              <StatCard label="Boss Hits" value={d().overview?.bossAttacks || 0} icon="⚔️" />
              <StatCard label="Streak" value={`${d().overview?.streak || 0}d`} icon="🔥" />
            </div>

            <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
              <h3 class="text-sm font-semibold text-ink-primary mb-4">Quiz Accuracy by Review Stage</h3>
              <Show when={d().quizPerformance?.accuracyByStage?.some((v: number) => v > 0)} fallback={
                <p class="text-sm text-ink-secondary">Complete quizzes to see your progress</p>
              }>
                <div class="flex items-end gap-2 h-32">
                  {(["Review 1", "Review 2", "Review 3", "Review 4"] as const).map((label, i) => {
                    const val = d().quizPerformance?.accuracyByStage?.[i] || 0;
                    return (
                      <div class="flex-1 flex flex-col items-center gap-1">
                        <span class="text-xs font-bold text-ink-primary">{val}%</span>
                        <div class="w-full bg-accent/60 rounded-t-sm hover:bg-accent transition-colors" style={{ height: `${val}%` }} />
                        <span class="text-[0.6rem] text-ink-secondary/70">{label}</span>
                      </div>
                    );
                  })}
                </div>
                <Show when={d().quizPerformance?.improvement > 0}>
                  <p class="text-xs text-success mt-3">+{d().quizPerformance?.improvement}% improvement across reviews!</p>
                </Show>
              </Show>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                <h3 class="text-sm font-semibold text-ink-primary mb-3">Your Stats</h3>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between"><span class="text-ink-secondary">Total Notes</span><span class="text-ink-primary font-medium">{d().insights?.totalNotes || 0}</span></div>
                  <div class="flex justify-between"><span class="text-ink-secondary">Total Quizzes</span><span class="text-ink-primary font-medium">{d().insights?.totalQuizzes || 0}</span></div>
                  <div class="flex justify-between"><span class="text-ink-secondary">Boss Kills</span><span class="text-ink-primary font-medium">{d().insights?.totalBossKills || 0}</span></div>
                  <div class="flex justify-between"><span class="text-ink-secondary">Best Day</span><span class="text-ink-primary font-medium">{d().insights?.bestDay || "-"}</span></div>
                </div>
              </div>
              <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                <h3 class="text-sm font-semibold text-ink-primary mb-3">Top Topics</h3>
                <div class="flex flex-wrap gap-2">
                  <Show when={(d().insights?.topTags?.length || 0) > 0} fallback={<p class="text-sm text-ink-secondary">Add tags to see topics</p>}>
                    {(d().insights?.topTags || []).map((t: { tag: string; count: number }) => (
                      <span class="px-3 py-1 rounded-full text-xs bg-accent/10 text-accent border border-accent/20">#{t.tag} <span class="opacity-60">{t.count}</span></span>
                    ))}
                  </Show>
                </div>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

function StatCard(props: { label: string; value: string | number; icon: string }) {
  return (
    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
      <span class="text-lg">{props.icon}</span>
      <p class="text-2xl font-bold text-ink-primary mt-1">{props.value}</p>
      <p class="text-xs text-ink-secondary mt-0.5">{props.label}</p>
    </div>
  );
}

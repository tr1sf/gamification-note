import { createResource, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authFetch, user } from "~/stores/auth";

interface CohortRow {
  date: string;
  signups: number;
  d3: number;
  d7: number;
  d30: number;
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  onMount(() => {
    if (user()?.role !== "admin") {
      navigate("/tavern", { replace: true });
    }
  });

  const [cohorts] = createResource(async () => {
    const res = await authFetch("/api/admin/export/cohorts");
    const json = await res.json();
    return json.success ? (json.data as CohortRow[]) : [];
  });

  const [stats] = createResource(async () => {
    const res = await authFetch("/api/admin/export/quiz-data");
    const json = await res.json();
    return json.success ? json.data : null;
  });

  const [dailyActivity] = createResource(async () => {
    const res = await authFetch("/api/admin/export/daily-activity");
    const json = await res.json();
    return json.success ? json.data : null;
  });

  const [correlations] = createResource(async () => {
    const res = await authFetch("/api/admin/export/correlations");
    const json = await res.json();
    return json.success ? json.data : null;
  });

  return (
    <div class="max-w-6xl mx-auto p-6 space-y-8">
      <h1 class="text-2xl font-display font-bold text-ink-primary">Admin Dashboard</h1>

      {/* Quick Stats */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-surface-elevated rounded-xl p-4 border border-surface-border">
          <p class="text-xs text-ink-secondary/60 uppercase tracking-wider">Total Users</p>
          <p class="text-2xl font-bold text-ink-primary mt-1">{stats()?.totalUsers ?? "..."}</p>
        </div>
        <div class="bg-surface-elevated rounded-xl p-4 border border-surface-border">
          <p class="text-xs text-ink-secondary/60 uppercase tracking-wider">Total Notes</p>
          <p class="text-2xl font-bold text-ink-primary mt-1">{stats()?.totalNotes ?? "..."}</p>
        </div>
        <div class="bg-surface-elevated rounded-xl p-4 border border-surface-border">
          <p class="text-xs text-ink-secondary/60 uppercase tracking-wider">Total Quizzes</p>
          <p class="text-2xl font-bold text-ink-primary mt-1">{stats()?.totalQuizzes ?? "..."}</p>
        </div>
        <div class="bg-surface-elevated rounded-xl p-4 border border-surface-border">
          <p class="text-xs text-ink-secondary/60 uppercase tracking-wider">Avg Quiz Score</p>
          <p class="text-2xl font-bold text-ink-primary mt-1">
            {stats()?.quizData?.length > 0
              ? Math.round(stats().quizData.reduce((s: number, d: any) => s + d.avgScore, 0) / stats().quizData.length) + "%"
              : "..."}
          </p>
        </div>
      </div>

      {/* Cohort Retention */}
      <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-ink-primary">Cohort Retention</h2>
          <button
            onClick={() => {
              const rows = (cohorts() || []).map((c) => [c.date, String(c.signups), String(c.d3), String(c.d7), String(c.d30)]);
              downloadCSV("cohorts.csv", ["Week", "Signups", "D3%", "D7%", "D30%"], rows);
            }}
            class="px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
          >
            Export CSV
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-ink-secondary/60">
                <th class="pb-2 font-medium">Week</th>
                <th class="pb-2 font-medium text-right">Signups</th>
                <th class="pb-2 font-medium text-right">D3</th>
                <th class="pb-2 font-medium text-right">D7</th>
                <th class="pb-2 font-medium text-right">D30</th>
              </tr>
            </thead>
            <tbody>
              <For each={cohorts()}>
                {(row) => (
                  <tr class="border-t border-surface-border/50">
                    <td class="py-2 text-ink-primary">{row.date}</td>
                    <td class="py-2 text-right text-ink-secondary">{row.signups}</td>
                    <td class="py-2 text-right">
                      <span class={row.d3 > 50 ? "text-success" : row.d3 > 20 ? "text-accent" : "text-ink-secondary"}>
                        {row.d3}%
                      </span>
                    </td>
                    <td class="py-2 text-right">
                      <span class={row.d7 > 30 ? "text-success" : row.d7 > 10 ? "text-accent" : "text-ink-secondary"}>
                        {row.d7}%
                      </span>
                    </td>
                    <td class="py-2 text-right">
                      <span class={row.d30 > 20 ? "text-success" : row.d30 > 5 ? "text-accent" : "text-ink-secondary"}>
                        {row.d30}%
                      </span>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Activity */}
      <Show when={dailyActivity()}>
        <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-ink-primary">Daily Activity (30d)</h2>
            <button
              onClick={() => {
                const rows = (dailyActivity()?.dailyActivity || []).map((d: any) => [d.date, String(d.total)]);
                downloadCSV("daily-activity.csv", ["Date", "Total Actions"], rows);
              }}
              class="px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div class="overflow-x-auto max-h-64 overflow-y-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-ink-secondary/60">
                  <th class="pb-2 font-medium">Date</th>
                  <th class="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <For each={(dailyActivity()?.dailyActivity || []).slice().reverse()}>
                  {(row: any) => (
                    <tr class="border-t border-surface-border/50">
                      <td class="py-2 text-ink-primary">{row.date}</td>
                      <td class="py-2 text-right text-ink-secondary">{row.total}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* Correlations */}
      <Show when={correlations()}>
        <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border">
          <h2 class="text-lg font-semibold text-ink-primary mb-4">Correlations</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="p-3 rounded-lg bg-surface border border-surface-border">
              <p class="text-xs text-ink-secondary/60">Level → Notes</p>
              <p class="text-lg font-bold text-ink-primary">{correlations().levelToNotes}</p>
            </div>
            <div class="p-3 rounded-lg bg-surface border border-surface-border">
              <p class="text-xs text-ink-secondary/60">Level → Quizzes</p>
              <p class="text-lg font-bold text-ink-primary">{correlations().levelToQuizzes}</p>
            </div>
            <div class="p-3 rounded-lg bg-surface border border-surface-border">
              <p class="text-xs text-ink-secondary/60">Streak → Notes</p>
              <p class="text-lg font-bold text-ink-primary">{correlations().streakToNotes}</p>
            </div>
            <div class="p-3 rounded-lg bg-surface border border-surface-border">
              <p class="text-xs text-ink-secondary/60">Streak → Quizzes</p>
              <p class="text-lg font-bold text-ink-primary">{correlations().streakToQuizzes}</p>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

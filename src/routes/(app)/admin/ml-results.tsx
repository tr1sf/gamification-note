import { createResource, For, Show, createEffect } from "solid-js";
import { authFetch, user } from "~/stores/auth";
import { useNavigate } from "@solidjs/router";

interface Metric {
  label: string;
  control: string;
  personalized: string;
  delta: string;
  significant: boolean;
}

export default function MLResultsPage() {
  const navigate = useNavigate();
  createEffect(() => {
    if (user() && user()!.role !== "admin") navigate("/tavern", { replace: true });
  });

  const [data] = createResource(async () => {
    const res = await authFetch("/api/admin/ml/results");
    const json = await res.json();
    return json.success ? json.data : null;
  });

  return (
    <Show when={user()?.role === "admin"} fallback={
      <div class="min-h-screen bg-surface flex items-center justify-center">
        <p class="text-ink-secondary">Verifying access...</p>
      </div>
    }>
      <div class="max-w-4xl mx-auto p-6 space-y-6">
        <h1 class="text-2xl font-display font-bold text-ink-primary">A/B Test Results</h1>
        <Show when={!data.loading && data()} fallback={
          <div class="bg-surface-elevated rounded-xl border border-surface-border p-8 text-center text-ink-secondary">
            <p class="animate-pulse">Loading data...</p>
          </div>
        }>
          <div class="bg-surface-elevated rounded-xl border border-surface-border overflow-hidden">
            <table class="w-full text-sm">
              <thead><tr class="border-b border-surface-border bg-surface-hover/50">
                <th class="p-3 text-left text-ink-secondary">Metric</th>
                <th class="p-3 text-right text-ink-secondary">Control</th>
                <th class="p-3 text-right text-ink-secondary">Personalized</th>
                <th class="p-3 text-right text-ink-secondary">Delta</th>
              </tr></thead>
              <tbody>
                <For each={data()?.metrics || []}>{(m: any) => (
                  <tr class="border-b border-surface-border/50">
                    <td class="p-3 text-ink-primary">{m.label}</td>
                    <td class="p-3 text-right font-mono">{m.control}</td>
                    <td class="p-3 text-right font-mono">{m.personalized}</td>
                    <td class={`p-3 text-right font-mono ${m.significant ? "text-success" : "text-ink-secondary"}`}>
                      {m.delta}{m.significant ? " ✓" : ""}
                    </td>
                  </tr>
                )}</For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </Show>
  );
}

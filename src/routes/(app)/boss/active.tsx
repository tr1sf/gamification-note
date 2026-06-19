import { createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";

export default function BossActivePage() {
  const [bosses] = createResource(async () => {
    const res = await authFetch("/api/boss/active");
    const json = await res.json();
    return json.success ? json.data : [];
  });

  return (
    <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 class="text-2xl font-display font-bold text-ink-primary">Active Bosses</h1>
      <Show
        when={!bosses.loading}
        fallback={
          <div class="space-y-3">
            {[1, 2].map(() => (
              <div class="h-24 bg-surface-border rounded-xl animate-pulse" />
            ))}
          </div>
        }
      >
        <Show
          when={(bosses()?.length ?? 0) > 0}
          fallback={
            <div class="text-center py-12 text-ink-secondary">
              <p class="text-5xl mb-4">⚔️</p>
              <p>No active bosses. Login tomorrow for a new daily boss!</p>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={bosses()}>
              {(boss: any) => (
                <A
                  href={`/boss/${boss.id}`}
                  class="block bg-surface-elevated rounded-xl p-5 border border-surface-border hover:border-error/30 transition-all"
                >
                  <div class="flex items-center gap-4">
                    <Show when={boss.iconImageUrl} fallback={<span class="text-4xl">{boss.bossEmoji || "\u{1F47B}"}</span>}>
                      <img src={boss.iconImageUrl} alt={boss.bossName} class="w-16 h-16 object-cover rounded-xl ring-2 ring-error/20" />
                    </Show>
                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-ink-primary">{boss.bossName || boss.title}</h3>
                        <span class="text-xs px-2 py-0.5 rounded border border-error/20 bg-error/5 text-error">
                          {boss.bossType?.toString().toUpperCase()}
                        </span>
                      </div>
                      <div class="h-3 bg-surface-border rounded-full overflow-hidden">
                        <div
                          class="h-full bg-error rounded-full transition-all"
                          style={{
                            width: `${Math.round(((boss.bossCurrentHp ?? 0) / (boss.bossMaxHp ?? 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <p class="text-xs text-ink-secondary mt-2">
                        {boss.bossCurrentHp} / {boss.bossMaxHp} HP
                      </p>
                    </div>
                  </div>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

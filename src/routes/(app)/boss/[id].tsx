import { createResource, Show, For, createSignal } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { showReward, addToast } from "~/stores/ui";
import { applyReward } from "~/stores/user";

export default function BossPage() {
  const params = useParams<{ id: string }>();
  const [boss, { refetch }] = createResource(
    () => params.id,
    async (id) => {
      const res = await authFetch(`/api/boss/${id}`);
      const json = await res.json();
      if (json.success) return json.data;
      throw new Error(json.error?.message);
    }
  );
  const [loot, setLoot] = createSignal<any>(null);
  const [claiming, setClaiming] = createSignal(false);

  const hpPct = () => {
    const b = boss();
    if (!b) return 0;
    return Math.max(
      0,
      Math.round(((b.bossCurrentHp ?? 0) / (b.bossMaxHp ?? 1)) * 100)
    );
  };
  const isDead = () => boss()?.status === "completed";

  const claimLoot = async () => {
    setClaiming(true);
    const res = await authFetch(`/api/boss/${params.id}/loot`);
    const json = await res.json();
    if (json.success) {
      setLoot(json.data);
      addToast(json.data.message, "success");
      refetch();
    }
    setClaiming(false);
  };

  return (
    <div class="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <A
        href="/challenges"
        class="text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← Back
      </A>
      <Show
        when={!boss.loading && boss()}
        fallback={
          <div class="h-96 bg-surface-border rounded-xl animate-pulse" />
        }
      >
        {(b) => (
          <>
            <div
              class={`bg-surface-elevated rounded-xl p-6 border ${
                isDead() ? "border-success/30" : "border-surface-border"
              }`}
            >
              <div class="flex items-center gap-4 mb-4">
                <Show when={b().iconImageUrl} fallback={<span class="text-4xl sm:text-5xl">{b().bossEmoji ?? "👻"}</span>}>
                  <img src={b().iconImageUrl} alt={b().bossName} class="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-xl ring-2 ring-error/20" />
                </Show>
                <div>
                  <h1 class="text-2xl font-display font-bold text-ink-primary">
                    {b().bossName ?? b().title}
                  </h1>
                  <p class="text-sm text-ink-secondary">{b().description}</p>
                </div>
              </div>
              <div class="space-y-2 mb-4">
                <div class="flex justify-between text-sm">
                  <span class="text-ink-secondary">HP</span>
                  <span class="text-ink-primary font-mono">
                    {b().bossCurrentHp} / {b().bossMaxHp}
                  </span>
                </div>
                <div class="h-4 bg-surface-border rounded-full overflow-hidden">
                  <div
                    class={`h-full rounded-full transition-all duration-700 ${
                      isDead()
                        ? "bg-success"
                        : hpPct() < 20
                          ? "bg-error animate-pulse"
                          : "bg-error"
                    }`}
                    style={{
                      width: `${isDead() ? 100 : hpPct()}%`,
                    }}
                  />
                </div>
              </div>
              <Show when={isDead()}>
                <div class="text-center py-4">
                  <p class="text-xl font-bold text-success mb-2">
                    🎉 Boss Defeated!
                  </p>
                  <button
                    onClick={claimLoot}
                    disabled={claiming() || !!loot()}
                    class="px-6 py-2 bg-accent text-white rounded-lg font-semibold"
                  >
                    {loot()
                      ? "Loot Claimed!"
                      : claiming()
                        ? "Claiming..."
                        : "Claim Loot!"}
                  </button>
                </div>
              </Show>
            </div>
            <Show when={!isDead()}>
              <div class="flex flex-col sm:flex-row gap-3">
                <A
                  href="/notes/new"
                  class="flex-1 py-3 bg-surface-elevated border border-surface-border rounded-xl text-center hover:border-accent/30 transition-colors"
                >
                  <span class="text-2xl">📝</span>
                  <p class="text-sm font-medium mt-1">Write Note</p>
                </A>
                <A
                  href="/quiz"
                  class="flex-1 py-3 bg-surface-elevated border border-surface-border rounded-xl text-center hover:border-accent/30 transition-colors"
                >
                  <span class="text-2xl">🧠</span>
                  <p class="text-sm font-medium mt-1">Review Quiz</p>
                </A>
                <A
                  href="/habits"
                  class="flex-1 py-3 bg-surface-elevated border border-surface-border rounded-xl text-center hover:border-accent/30 transition-colors"
                >
                  <span class="text-2xl">🔥</span>
                  <p class="text-sm font-medium mt-1">Daily Ritual</p>
                </A>
              </div>
            </Show>
            <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
              <h3 class="text-sm font-semibold text-ink-primary mb-3">
                Battle Log
              </h3>
              <Show
                when={(b().attacks?.length ?? 0) > 0}
                fallback={
                  <p class="text-sm text-ink-secondary">
                    No attacks yet. Strike first!
                  </p>
                }
              >
                <div class="space-y-2 max-h-32 sm:max-h-64 overflow-y-auto">
                  <For each={b().attacks ?? []}>
                    {(a: any) => (
                      <div class="text-xs text-ink-secondary flex justify-between py-1 border-b border-surface-border/30">
                        <span>
                          {a.metadata?.source === "quiz"
                            ? "🧠 Quiz"
                            : a.metadata?.source === "habit"
                              ? "🔥 Habit"
                              : "📝 Note"}
                          : -{a.metadata?.damage ?? 0} HP
                        </span>
                        <span>
                          {new Date(a.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
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

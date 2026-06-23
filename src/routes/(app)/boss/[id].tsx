import { createResource, Show, For, createSignal } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { showReward, addToast } from "~/stores/ui";
import { applyReward } from "~/stores/user";

function abilityMeta(type: string) {
  if (type?.startsWith("weak_"))
    return { label: "WEAKNESS", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", icon: "🎯" };
  if (type === "fog_shield" || type === "thick_hide" || type === "void_immune")
    return { label: "RESISTANCE", color: "border-red-500/30 bg-red-500/10 text-red-400", icon: "🛡️" };
  if (type === "regen")
    return { label: "PASSIVE", color: "border-purple-500/30 bg-purple-500/10 text-purple-400", icon: "♻️" };
  if (type === "dust_cloud" || type === "procrastination_aura")
    return { label: "AURA", color: "border-amber-500/30 bg-amber-500/10 text-amber-400", icon: "🌫️" };
  return { label: "ABILITY", color: "border-sky-500/30 bg-sky-500/10 text-sky-400", icon: "✨" };
}

function getBestStrategy(ability: any): string {
  if (!ability) return "Attack freely with any method.";
  switch (ability.type) {
    case "thick_hide": return "Use NOTES — deals bonus damage. Avoid quizzes.";
    case "fog_shield": return "Attack 3 times to break the fog shield, then normal damage resumes.";
    case "blank_curse": return "Balance notes with quizzes — notes heal the boss but empower your next hit.";
    case "void_immune": return "Use NOTES or HABITS only. Quizzes have no effect.";
    case "regen": return "Kill before midnight or it will heal. Focus fire!";
    case "procrastination_aura": return "Complete a daily quest first to restore full note damage.";
    case "dust_cloud": return "Notes may miss. Switch to quizzes or habits for reliable damage.";
    case "colossal": return "Use all 3 types (note + quiz + habit) in one day for full damage.";
    case "weak_note": return "Spam NOTES — they deal 3x damage!";
    case "weak_quiz": return "Spam QUIZZES — they deal 3x damage!";
    case "weak_habit": return "Spam HABITS — they deal 3x damage!";
    default: return "Attack freely with any method.";
  }
}

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
    return Math.max(0, Math.round(((b.bossCurrentHp ?? 0) / (b.bossMaxHp ?? 1)) * 100));
  };
  const isDead = () => boss()?.status === "completed";
  const ability = () => (boss()?.bossAbility as any) || null;
  const meta = () => abilityMeta(ability()?.type || "");

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
      <A href="/boss/active" class="text-sm text-ink-secondary hover:text-ink-primary">← Back to bosses</A>
      <Show when={!boss.loading && boss()} fallback={<div class="h-96 bg-surface-border rounded-xl animate-pulse" />}>
        {(b) => (
          <>
            <div class={`bg-surface-elevated rounded-xl p-6 border ${isDead() ? "border-success/30" : "border-surface-border"}`}>
              <div class="flex items-center gap-4 mb-5">
                <Show when={b().iconImageUrl} fallback={<span class="text-4xl sm:text-5xl">{b().bossEmoji ?? "👻"}</span>}>
                  <img src={b().iconImageUrl} alt={b().bossName} class="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-xl ring-2 ring-error/20" />
                </Show>
                <div>
                  <h1 class="text-2xl font-display font-bold text-ink-primary">{b().bossName ?? b().title}</h1>
                  <p class="text-sm text-ink-secondary">{b().description}</p>
                </div>
              </div>

              {/* Ability card */}
              <Show when={ability()}>
                <div class={`mb-5 rounded-xl p-4 border ${meta().color} bg-surface/50`}>
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-lg">{meta().icon}</span>
                      <span class="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded border-current border">{meta().label}</span>
                    </div>
                    <span class="text-sm font-semibold">{ability().icon} {ability().name}</span>
                  </div>
                  <p class="text-sm opacity-90 mb-2">{ability().description}</p>
                  <div class="border-t border-current/10 pt-2 mt-2">
                    <p class="text-xs opacity-70">
                      <span class="font-semibold">Strategy:</span> {getBestStrategy(ability())}
                    </p>
                  </div>
                </div>
              </Show>

              <div class="space-y-2 mb-4">
                <div class="flex justify-between text-sm">
                  <span class="text-ink-secondary">HP</span>
                  <span class="text-ink-primary font-mono">{b().bossCurrentHp} / {b().bossMaxHp}</span>
                </div>
                <div class="h-4 bg-surface-border rounded-full overflow-hidden">
                  <div
                    class={`h-full rounded-full transition-all duration-700 ${
                      isDead() ? "bg-success" : hpPct() < 20 ? "bg-error animate-pulse" : "bg-error"
                    }`}
                    style={{ width: `${isDead() ? 100 : hpPct()}%` }}
                  />
                </div>
              </div>

              <Show when={isDead()}>
                <div class="text-center py-4">
                  <p class="text-xl font-bold text-success mb-2">🎉 Boss Defeated!</p>
                  <button
                    onClick={claimLoot}
                    disabled={claiming() || !!loot()}
                    class="px-6 py-2 bg-accent text-white rounded-lg font-semibold"
                  >
                    {loot() ? "Loot Claimed!" : claiming() ? "Claiming..." : "Claim Loot!"}
                  </button>
                </div>
              </Show>
            </div>

            <Show when={!isDead()}>
              <div class="flex flex-col sm:flex-row gap-3">
                <A href="/notes/new" class="flex-1 py-3 bg-surface-elevated border border-surface-border rounded-xl text-center hover:border-accent/30 transition-colors">
                  <span class="text-2xl">📝</span>
                  <p class="text-sm font-medium mt-1">Write Note</p>
                </A>
                <A href="/quiz" class="flex-1 py-3 bg-surface-elevated border border-surface-border rounded-xl text-center hover:border-accent/30 transition-colors">
                  <span class="text-2xl">🧠</span>
                  <p class="text-sm font-medium mt-1">Review Quiz</p>
                </A>
                <A href="/habits" class="flex-1 py-3 bg-surface-elevated border border-surface-border rounded-xl text-center hover:border-accent/30 transition-colors">
                  <span class="text-2xl">🔥</span>
                  <p class="text-sm font-medium mt-1">Daily Ritual</p>
                </A>
              </div>
            </Show>

            <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
              <h3 class="text-sm font-semibold text-ink-primary mb-3">Battle Log</h3>
              <Show
                when={(b().attacks?.length ?? 0) > 0}
                fallback={<p class="text-sm text-ink-secondary">No attacks yet. Strike first!</p>}
              >
                <div class="space-y-2 max-h-32 sm:max-h-64 overflow-y-auto">
                  <For each={b().attacks ?? []}>
                    {(a: any) => (
                      <div class="text-xs text-ink-secondary">
                        <div class="flex justify-between py-1 border-b border-surface-border/30">
                          <span>
                            {a.metadata?.source === "quiz" ? "🧠 Quiz" : a.metadata?.source === "habit" ? "🔥 Habit" : "📝 Note"}
                            : -{a.metadata?.damage ?? 0} HP
                          </span>
                          <span>{new Date(a.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <Show when={a.metadata?.abilityMsg}>
                          <div class="text-[10px] text-amber-400/80 pb-1 border-b border-surface-border/30">
                            {a.metadata.abilityMsg}
                          </div>
                        </Show>
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

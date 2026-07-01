import { createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch, user } from "~/stores/auth";
import { gamification } from "~/stores/user";
import Nelar from "~/components/mascot/Nelar";
import { PATH_UNLOCKS, type UserPath } from "~/lib/path-unlocks";

function abilityColor(type: string) {
  if (type?.startsWith("weak_")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (type === "fog_shield") return "border-sky-500/30 bg-sky-500/10 text-sky-400";
  if (type === "regen") return "border-purple-500/30 bg-purple-500/10 text-purple-400";
  return "border-amber-500/30 bg-amber-500/10 text-amber-400";
}

function abilityTypeLabel(type: string) {
  if (type?.startsWith("weak_")) return "WEAKNESS";
  if (type === "fog_shield" || type === "thick_hide" || type === "void_immune") return "RESISTANCE";
  if (type === "regen") return "PASSIVE";
  return "ABILITY";
}

function getBossUnlockLevel(path: UserPath | null): number {
  if (!path) return 7;
  const unlocks = PATH_UNLOCKS[path];
  return unlocks.find((u) => u.feature === "Boss Fight")?.level ?? 7;
}

export default function BossActivePage() {
  const userPath = () => (user()?.path as UserPath) || "student";
  const bossLocked = () => {
    const path = userPath();
    const level = gamification().level;
    const unlockLevel = getBossUnlockLevel(path);
    return level < unlockLevel;
  };
  const bossUnlockLevel = () => getBossUnlockLevel(userPath());

  const [bosses] = createResource(async () => {
    const res = await authFetch("/api/boss/active");
    const json = await res.json();
    return json.success ? json.data : [];
  });

  return (
    <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 class="text-2xl font-display font-bold text-ink-primary">Active Bosses</h1>

      <Show when={bossLocked()}>
        <div class="bg-surface-elevated rounded-xl p-8 border border-surface-border text-center">
          <p class="text-5xl mb-3 grayscale">⚔️</p>
          <p class="text-lg font-semibold text-ink-primary mb-1">Boss Fight Locked</p>
          <p class="text-sm text-ink-secondary">
            Reach <span class="font-mono font-bold text-accent">Lv.{bossUnlockLevel()}</span> to unlock Boss Fight
          </p>
          <p class="text-xs text-ink-muted mt-2">
            Your path: <span class="capitalize font-medium">{userPath()}</span>
          </p>
        </div>
      </Show>

      <Show when={!bossLocked()}>
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
                <Nelar state="idle" size={56} class="mx-auto mb-2" />
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
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1 gap-2">
                          <h3 class="font-bold text-ink-primary truncate">{boss.bossName || boss.title}</h3>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-xs px-2 py-0.5 rounded border border-error/20 bg-error/5 text-error">
                              {boss.bossType?.toString().toUpperCase()}
                            </span>
                            <Show when={boss.bossAbility}>
                              <span
                                class={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${abilityColor((boss.bossAbility as any).type)}`}
                                title={`${(boss.bossAbility as any).name}: ${(boss.bossAbility as any).description}`}
                              >
                                {(boss.bossAbility as any).icon} {(boss.bossAbility as any).name}
                              </span>
                            </Show>
                          </div>
                        </div>
                        <div class="h-3 bg-surface-border rounded-full overflow-hidden mb-1.5">
                          <div
                            class="h-full bg-error rounded-full transition-all"
                            style={{
                              width: `${Math.round(((boss.bossCurrentHp ?? 0) / (boss.bossMaxHp ?? 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <div class="flex items-center justify-between">
                          <p class="text-xs text-ink-secondary">
                            {boss.bossCurrentHp} / {boss.bossMaxHp} HP
                          </p>
                          <p class="text-[10px] text-ink-muted">
                            ~{Math.max(1, Math.ceil((boss.bossCurrentHp ?? 0) / (boss.bossType === "daily" ? 50 : 60)))}d left
                          </p>
                        </div>
                      </div>
                    </div>
                  </A>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

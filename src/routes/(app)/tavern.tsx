import { createResource, createSignal, For, Show, onMount } from "solid-js";
import { authFetch, user as authUser } from "~/stores/auth";
import { gamification, xpProgressInLevel } from "~/stores/user";
import { quests, fetchActiveQuests, type Quest } from "~/stores/quests";
import RadarChart, { type RadarStat } from "~/components/gamification/RadarChart";

// ── Dashboard stats API ──────────────────────────────────────────────────────
interface DashboardData {
  totalNotes: number;
  totalWords: number;
  streak: number;
  questsCompleted: number;
  achievementsUnlocked: number;
  recentXP: Array<{ actionType: string; xpChange: number; createdAt: string }>;
}

async function fetchDashboard(): Promise<DashboardData | null> {
  if (typeof document === "undefined") return null; // SSR — don't fetch
  try {
    const res = await authFetch("/api/stats/dashboard");
    const json = await res.json();
    if (json.success) return json.data as DashboardData;
    return null;
  } catch {
    return null;
  }
}

// ── Attribute derivation (0–100 scale, no DB stats exist) ─────────────────────
// Intel     — knowledge written (total words across notes)
const deriveIntel = (totalWords: number) => Math.min(100, Math.round(totalWords / 50));
// Physical  — consistency (login streak)
const derivePhysical = (streak: number) => Math.min(100, streak * 10);
// Core      — raw character power (level + a fraction of total XP)
const deriveCore = (level: number, xp: number) =>
  Math.min(100, Math.round(level * 8 + xp / 100));
// Spiritual — enlightenment (achievements unlocked)
const deriveSpiritual = (achievements: number) => Math.min(100, achievements * 12);
// Psyche    — focus/willpower (quests completed)
const derivePsyche = (questsDone: number) => Math.min(100, questsDone * 10);

const DAILY_GOAL = 7;

const STAT_COLORS = {
  Physical: "#4ade80", // green
  Psyche: "#f472b6", // pink/magenta
  Intel: "#22d3ee", // cyan
  Spiritual: "#a78bfa", // purple
  Core: "#fbbf24", // gold
};

export default function TavernPage() {
  const [dashboard] = createResource(fetchDashboard);
  const [questTab, setQuestTab] = createSignal<"plan" | "today" | "done">("today");

  onMount(() => {
    fetchActiveQuests();
  });

  const d = () => dashboard();

  // ── Derived attribute values ──
  const intel = () => deriveIntel(d()?.totalWords ?? 0);
  const physical = () => derivePhysical(d()?.streak ?? gamification().streak ?? 0);
  const core = () => deriveCore(gamification().level, gamification().xp);
  const spiritual = () => deriveSpiritual(d()?.achievementsUnlocked ?? 0);
  const psyche = () => derivePsyche(d()?.questsCompleted ?? 0);

  // Radar order, clockwise from top: Intel, Physical, Core, Spiritual, Psyche.
  const radarStats = (): RadarStat[] => [
    { label: "Intel", value: intel(), color: STAT_COLORS.Intel },
    { label: "Physical", value: physical(), color: STAT_COLORS.Physical },
    { label: "Core", value: core(), color: STAT_COLORS.Core },
    { label: "Spiritual", value: spiritual(), color: STAT_COLORS.Spiritual },
    { label: "Psyche", value: psyche(), color: STAT_COLORS.Psyche },
  ];

  // Stats Summary rows (right card) — each in its own color.
  const summaryRows = () => [
    { label: "Physical", value: physical(), color: STAT_COLORS.Physical },
    { label: "Psyche", value: psyche(), color: STAT_COLORS.Psyche },
    { label: "Intel", value: intel(), color: STAT_COLORS.Intel },
    { label: "Spiritual", value: spiritual(), color: STAT_COLORS.Spiritual },
    { label: "Core", value: core(), color: STAT_COLORS.Core },
  ];

  // ── "Today" card ──
  const isToday = (iso: string) => {
    const dt = new Date(iso);
    const now = new Date();
    return (
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate()
    );
  };
  const todayEntries = () => (d()?.recentXP ?? []).filter((e) => isToday(e.createdAt));
  const xpToday = () => todayEntries().reduce((sum, e) => sum + e.xpChange, 0);
  const tasksToday = () => todayEntries().length;
  const weekday = () => new Date().toLocaleDateString(undefined, { weekday: "long" });
  const progressPct = () => Math.min(100, Math.round((tasksToday() / DAILY_GOAL) * 100));
  const filledSquares = () => Math.round((progressPct() / 100) * 6);

  // ── Level / XP ──
  const lvl = () => gamification().level;
  const xpProg = () => xpProgressInLevel(gamification().xp, lvl());
  const xpPct = () => Math.round((xpProg().current / xpProg().needed) * 100);

  // ── Player identity ──
  const name = () => authUser()?.username ?? "Adventurer";
  const initial = () => name().charAt(0).toUpperCase();
  const avatar = () => authUser()?.avatarUrl ?? null;
  const coins = () => gamification().coins;
  const totalXP = () => gamification().xp;

  // ── Quests ──
  const visibleQuests = (): Quest[] => {
    const all = quests();
    if (questTab() === "done") {
      return all.filter((q) => q.status === "completed" || q.status === "claimed").slice(0, 3);
    }
    if (questTab() === "plan") {
      return all.filter((q) => (q.status ?? "active") === "active").slice(0, 3);
    }
    return all.slice(0, 3);
  };

  return (
    <div class="min-h-full bg-[#0b0f0b] text-[#d6f5d6] font-body">
      <div class="max-w-6xl mx-auto p-4 sm:p-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* ─────────── LEFT: Avatar + Today ─────────── */}
          <section class="lg:col-span-3 space-y-4">
            {/* Avatar */}
            <div>
              <span class="block h-px w-full bg-white/20 mb-3" aria-hidden="true" />
              <div class="aspect-[3/4] rounded-2xl overflow-hidden border border-[#243024] bg-[#1a221a]">
                <Show
                  when={avatar()}
                  fallback={
                    <div
                      class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#16301f] via-[#0e1a12] to-[#1a221a]"
                      aria-hidden="true"
                    >
                      <span class="font-display text-7xl font-bold text-[#86efac]">{initial()}</span>
                    </div>
                  }
                >
                  <img src={avatar()!} alt={`${name()}'s portrait`} class="w-full h-full object-cover" />
                </Show>
              </div>
              <span class="block h-px w-full bg-white/20 mt-3" aria-hidden="true" />
            </div>

            <div class="flex items-center justify-between">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a221a] border border-[#243024] text-xs text-[#86efac]">
                <span aria-hidden="true">☀️</span> Today
              </span>
              <button
                type="button"
                class="text-[#4a5a4a] hover:text-[#86efac] transition-colors"
                aria-label="Filter today's view"
              >
                <span aria-hidden="true">⌗</span>
              </button>
            </div>

            {/* Weekday / progress card */}
            <div class="rounded-2xl border border-[#243024] bg-[#1a221a] p-4">
              <h2 class="font-display text-lg text-[#d6f5d6] mb-3">{weekday()}</h2>

              <div class="flex items-center gap-2 mb-3">
                <span class="text-xs text-[#7a8a7a]">Progress:</span>
                <span
                  class="font-mono tracking-tight text-[#4ade80]"
                  role="progressbar"
                  aria-valuenow={progressPct()}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Today's progress"
                >
                  <For each={[0, 1, 2, 3, 4, 5]}>
                    {(i) => <span aria-hidden="true">{i < filledSquares() ? "▰" : "▱"}</span>}
                  </For>
                </span>
                <span class="font-mono text-sm text-[#86efac]">{progressPct()}%</span>
              </div>

              <p class="text-sm italic text-[#9bbf9b]">
                You've Gained <span class="font-mono not-italic text-[#86efac]">{xpToday()}</span> XPs Today.
              </p>
              <p class="text-sm italic text-[#9bbf9b]">
                You've Completed <span class="font-mono not-italic text-[#86efac]">{tasksToday()}</span> Tasks Today.
              </p>
              <p class="text-sm italic text-[#fbbf24] mt-2">You got this!</p>

              <a
                href="/notes/new"
                class="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#2a352a] py-2 text-sm text-[#6a7a6a] hover:text-[#86efac] hover:border-[#4ade80]/40 transition-colors"
              >
                <span aria-hidden="true">+</span> New page
              </a>
            </div>
          </section>

          {/* ─────────── MIDDLE: Stats Radar ─────────── */}
          <section class="lg:col-span-5">
            <p class="text-xs italic text-[#6a7a6a] mb-1">Stats Radar</p>
            <div class="rounded-2xl border border-[#243024] bg-[#1a221a] p-4 sm:p-6 flex items-center justify-center">
              <div class="w-full max-w-sm">
                <RadarChart stats={radarStats()} />
              </div>
            </div>
          </section>

          {/* ─────────── RIGHT: Player ID ─────────── */}
          <section class="lg:col-span-4">
            <div class="rounded-2xl border border-[#243024] bg-[#1a221a] overflow-hidden">
              {/* header */}
              <div class="flex items-center justify-between px-4 py-3 border-b border-[#243024]">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0e120e] border border-[#243024] text-xs text-[#86efac]">
                  <span aria-hidden="true">🛡️</span> Player ID
                </span>
                <button
                  type="button"
                  class="text-[#4a5a4a] hover:text-[#86efac] transition-colors"
                  aria-label="Player settings"
                >
                  <span aria-hidden="true">⚙</span>
                </button>
              </div>

              <div class="p-4 space-y-3">
                <div>
                  <h2 class="font-display text-xl font-bold text-[#d6f5d6] flex items-center gap-1.5">
                    <span aria-hidden="true">⭐</span> {name()}
                  </h2>
                  <p class="text-xs text-[#6a7a6a]">Update Status</p>
                </div>

                {/* key/value rows */}
                <dl class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-[#7a8a7a]">Class:</dt>
                    <dd class="font-mono text-[#d6f5d6]">{gamification().title}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-[#7a8a7a]">Streak:</dt>
                    <dd class="font-mono text-[#d6f5d6]">🔥 {gamification().streak} days</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-[#7a8a7a]">Owned:</dt>
                    <dd class="font-mono text-[#86efac]">{coins()} Coins</dd>
                  </div>
                </dl>

                {/* Level + XP bar */}
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-xs font-mono text-[#fbbf24] shrink-0">
                    Level {lvl()}
                  </span>
                  <div class="flex-1">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-mono text-[#86efac]">{xpPct()}%</span>
                      <span class="font-mono text-[#6a7a6a]">
                        {xpProg().current}/{xpProg().needed}
                      </span>
                    </div>
                    <div
                      class="h-1.5 rounded-full bg-[#0e120e] overflow-hidden"
                      role="progressbar"
                      aria-valuenow={xpPct()}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Level ${lvl()} progress`}
                    >
                      <div class="h-full rounded-full bg-[#4ade80]" style={{ width: `${xpPct()}%` }} />
                    </div>
                  </div>
                </div>

                {/* divider */}
                <div class="flex items-center justify-center gap-2 text-[#3a4a3a] text-xs py-1" aria-hidden="true">
                  <span class="flex-1 border-t border-dotted border-[#2a352a]" />
                  <span>· Stats Summary ·</span>
                  <span class="flex-1 border-t border-dotted border-[#2a352a]" />
                </div>

                {/* stat rows, each own color */}
                <ul class="space-y-1 text-sm">
                  <For each={summaryRows()}>
                    {(s) => (
                      <li class="flex justify-between italic">
                        <span style={{ color: s.color }}>{s.label}:</span>
                        <span class="font-mono not-italic" style={{ color: s.color }}>
                          {Math.round(s.value)}
                        </span>
                      </li>
                    )}
                  </For>
                </ul>

                <p class="text-sm font-mono text-[#fb923c]">Total: {totalXP()} XPs</p>

                <p class="text-sm text-[#7a8a7a] flex items-center gap-1.5">
                  <span aria-hidden="true">📊</span> Log Status
                </p>

                <a
                  href="/notes/new"
                  class="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#2a352a] py-2 text-sm text-[#6a7a6a] hover:text-[#86efac] hover:border-[#4ade80]/40 transition-colors"
                >
                  <span aria-hidden="true">+</span> New page
                </a>
              </div>
            </div>
          </section>

          {/* ─────────── BOTTOM: Today's Quests (spans middle+right) ─────────── */}
          <section class="lg:col-span-9 lg:col-start-4">
            <div class="rounded-2xl border border-[#243024] bg-[#1a221a] p-4">
              <h2 class="font-display text-lg text-[#2dd4bf] italic flex items-center gap-1.5 mb-3">
                <span aria-hidden="true">🎮</span> Today's Quests <span class="text-xs" aria-hidden="true">▼</span>
              </h2>

              {/* tabs */}
              <div class="flex items-center gap-1 mb-4 text-sm">
                <For
                  each={
                    [
                      { id: "plan" as const, label: "📝 Plan" },
                      { id: "today" as const, label: "☀️ Today" },
                      { id: "done" as const, label: "✓ Done" },
                    ]
                  }
                >
                  {(t) => (
                    <button
                      type="button"
                      onClick={() => setQuestTab(t.id)}
                      class={`px-3 py-1 rounded-full transition-colors ${
                        questTab() === t.id
                          ? "bg-[#0e120e] border border-[#4ade80]/40 text-[#86efac]"
                          : "text-[#6a7a6a] hover:text-[#9bbf9b]"
                      }`}
                      aria-pressed={questTab() === t.id}
                    >
                      {t.label}
                    </button>
                  )}
                </For>
              </div>

              {/* quest cards */}
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <For each={visibleQuests()}>
                  {(q) => {
                    const done = () => q.status === "completed" || q.status === "claimed";
                    return (
                      <div class="rounded-xl border border-[#243024] bg-[#0e120e] p-3 flex flex-col gap-2">
                        <h3 class="text-sm font-semibold text-[#d6f5d6] line-clamp-2">{q.title}</h3>
                        <div class="flex flex-wrap gap-1.5">
                          <span class="px-2 py-0.5 rounded-full bg-[#2dd4bf]/15 text-[#2dd4bf] text-[10px] font-mono">
                            {q.questType}
                          </span>
                          <span class="px-2 py-0.5 rounded-full bg-[#fbbf24]/15 text-[#fbbf24] text-[10px] font-mono">
                            {q.xpReward} XP
                          </span>
                          <Show when={q.coinReward > 0}>
                            <span class="px-2 py-0.5 rounded-full bg-[#4ade80]/15 text-[#4ade80] text-[10px] font-mono">
                              +{q.coinReward} 🪙
                            </span>
                          </Show>
                        </div>
                        <a
                          href="/quests"
                          class={`mt-auto text-center text-xs font-semibold rounded-lg py-1.5 transition-colors ${
                            done()
                              ? "bg-[#243024] text-[#6a7a6a] cursor-default"
                              : "bg-[#4ade80]/15 text-[#86efac] hover:bg-[#4ade80]/25"
                          }`}
                          aria-disabled={done()}
                        >
                          {done() ? "Completed" : "Complete"}
                        </a>
                      </div>
                    );
                  }}
                </For>

                {/* empty placeholder card */}
                <a
                  href="/quests"
                  class="rounded-xl border border-dashed border-[#2a352a] flex items-center justify-center gap-1.5 p-6 text-sm text-[#6a7a6a] hover:text-[#86efac] hover:border-[#4ade80]/40 transition-colors min-h-[7rem]"
                >
                  <span aria-hidden="true">+</span> New page
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

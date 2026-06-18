import { createResource, createSignal, For, Show, onMount } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch, user as authUser } from "~/stores/auth";
import { gamification, xpProgressInLevel } from "~/stores/user";
import { quests, fetchActiveQuests, type Quest } from "~/stores/quests";
import RadarChart, { type RadarStat } from "~/components/gamification/RadarChart";
import MoodPicker from "~/components/mood/MoodPicker";
import GratitudeGarden from "~/components/gratitude/GratitudeGarden";
import FocusTimer from "~/components/focus/FocusTimer";
import ProjectList from "~/components/projects/ProjectCard";

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

// Theme-aware stat colors (follow light/dark automatically via CSS vars).
const STAT_COLORS = {
  Physical: "var(--color-rarity-uncommon)", // green
  Psyche: "var(--color-error)",             // red/rose
  Intel: "var(--color-rarity-rare)",        // blue
  Spiritual: "var(--color-rarity-epic)",    // purple
  Core: "var(--color-accent)",              // gold
};

export default function TavernPage() {
  const [dashboard] = createResource(fetchDashboard);
  const [bosses] = createResource(async () => {
    if (typeof document === "undefined") return [];
    try {
      const res = await authFetch("/api/boss/active");
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  const [pendingQuizzes] = createResource(async () => {
    if (typeof document === "undefined") return [];
    try {
      const res = await authFetch("/api/quiz/pending");
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  const [questTab, setQuestTab] = createSignal<"plan" | "today" | "done">("today");
  const [digestData, setDigestData] = createSignal<string | null>(null);
  const [digestLoading, setDigestLoading] = createSignal(false);

  const loadDigest = async () => {
    setDigestLoading(true);
    try {
      const res = await authFetch("/api/digest");
      const json = await res.json();
      if (json.success) setDigestData(json.data.digest);
    } catch { /* ignore */ }
    setDigestLoading(false);
  };

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
    <div class="min-h-full bg-surface text-ink-primary">
      <div class="max-w-6xl mx-auto p-4 sm:p-6">
        <header class="mb-5">
          {/* Tavern Banner */}
          <div class="relative rounded-xl overflow-hidden mb-6 h-32 sm:h-40 bg-gradient-to-r from-accent/20 via-surface-elevated to-accent/10 border border-surface-border flex items-center justify-center">
            <div class="absolute inset-0 opacity-10" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, var(--color-accent) 10px, var(--color-accent) 11px);" />
            <div class="relative text-center">
              <p class="text-3xl sm:text-4xl">🏰</p>
              <p class="text-xs sm:text-sm text-ink-secondary/60 mt-1 font-display tracking-widest uppercase">Welcome back, adventurer</p>
            </div>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold text-ink-primary">Tavern Hall</h1>
          <p class="text-sm text-ink-secondary mt-0.5">Your adventurer's dashboard</p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* ─────────── LEFT: Avatar + Today ─────────── */}
          <section class="lg:col-span-3 space-y-4">
            {/* Avatar */}
            <div>
              <span class="block h-px w-full bg-accent/25 mb-3" aria-hidden="true" />
              <div class="aspect-[3/4] rounded-2xl overflow-hidden border border-surface-border bg-surface-elevated shadow-md">
                <Show
                  when={avatar()}
                  fallback={
                    <div
                      class="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-hover via-surface to-surface-elevated"
                      aria-hidden="true"
                    >
                      <span class="font-display text-7xl font-bold text-accent">{initial()}</span>
                    </div>
                  }
                >
                  <img src={avatar()!} alt={`${name()}'s portrait`} class="w-full h-full object-cover" />
                </Show>
              </div>
              <span class="block h-px w-full bg-accent/25 mt-3" aria-hidden="true" />
            </div>

            <div class="flex items-center justify-between">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-surface-border text-xs text-accent">
                <span aria-hidden="true">☀️</span> Today
              </span>
              <button
                type="button"
                class="text-ink-secondary/60 hover:text-accent transition-colors"
                aria-label="Filter today's view"
              >
                <span aria-hidden="true">⌗</span>
              </button>
            </div>

            {/* Weekday / progress card */}
            <div class="rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm">
              <h2 class="font-display text-lg text-ink-primary mb-3">{weekday()}</h2>

              <div class="flex items-center gap-2 mb-3">
                <span class="text-xs text-ink-secondary">Progress:</span>
                <span
                  class="font-mono tracking-tight text-accent"
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
                <span class="font-mono text-sm text-accent">{progressPct()}%</span>
              </div>

              <p class="text-sm italic text-ink-secondary">
                You've gained <span class="font-mono not-italic text-accent">{xpToday()}</span> XP today.
              </p>
              <p class="text-sm italic text-ink-secondary">
                You've completed <span class="font-mono not-italic text-accent">{tasksToday()}</span> tasks today.
              </p>
              <p class="text-sm italic text-coin mt-2">You got this!</p>

              <a
                href="/notes/new"
                class="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-border py-2 text-sm text-ink-secondary/80 hover:text-accent hover:border-accent/40 transition-colors"
              >
                <span aria-hidden="true">+</span> New scroll
              </a>
            </div>
          </section>

          {/* ─────────── MIDDLE: Stats Radar ─────────── */}
          <section class="lg:col-span-5">
            <p class="text-xs italic text-ink-secondary mb-1">Stats Radar</p>
            <div class="rounded-2xl border border-surface-border bg-surface-elevated p-4 sm:p-6 flex items-center justify-center shadow-sm">
              <div class="w-full max-w-sm">
                <Show when={d()?.totalNotes === 0} fallback={<RadarChart stats={radarStats()} />}>
                  <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border text-center space-y-4">
                    <p class="text-5xl">📜</p>
                    <h3 class="text-lg font-bold text-ink-primary">Your adventure begins!</h3>
                    <p class="text-sm text-ink-secondary max-w-xs mx-auto">Write your first scroll to unlock your character stats, quests, and boss fights.</p>
                    <A href="/notes/new" class="inline-block px-6 py-2 bg-accent text-white rounded-lg font-medium text-sm">Write Your First Scroll</A>
                  </div>
                </Show>
              </div>
            </div>
          </section>

          {/* ─────────── RIGHT: Player ID ─────────── */}
          <section class="lg:col-span-4">
            <div class="rounded-2xl border border-surface-border bg-surface-elevated overflow-hidden shadow-sm">
              {/* header */}
              <div class="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-surface-border text-xs text-accent">
                  <span aria-hidden="true">🛡️</span> Player ID
                </span>
                <button
                  type="button"
                  class="text-ink-secondary/60 hover:text-accent transition-colors"
                  aria-label="Player settings"
                >
                  <span aria-hidden="true">⚙</span>
                </button>
              </div>

              <div class="p-4 space-y-3">
                <div>
                  <h2 class="font-display text-xl font-bold text-ink-primary flex items-center gap-1.5">
                    <span aria-hidden="true">⭐</span> {name()}
                  </h2>
                  <p class="text-xs text-ink-secondary">Update Status</p>
                </div>

                {/* key/value rows */}
                <dl class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-ink-secondary">Class:</dt>
                    <dd class="font-mono text-ink-primary">{gamification().title}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-ink-secondary">Streak:</dt>
                    <dd class="font-mono text-ink-primary">🔥 {gamification().streak} days</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-ink-secondary">Owned:</dt>
                    <dd class="font-mono text-coin">{coins()} Coins</dd>
                  </div>
                </dl>

                {/* Level + XP bar */}
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-xs font-mono text-accent shrink-0">
                    Level {lvl()}
                  </span>
                  <div class="flex-1">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-mono text-accent">{xpPct()}%</span>
                      <span class="font-mono text-ink-secondary">
                        {xpProg().current}/{xpProg().needed}
                      </span>
                    </div>
                    <div
                      class="h-1.5 rounded-full bg-surface overflow-hidden"
                      role="progressbar"
                      aria-valuenow={xpPct()}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Level ${lvl()} progress`}
                    >
                      <div class="h-full rounded-full bg-accent" style={{ width: `${xpPct()}%` }} />
                    </div>
                  </div>
                </div>

                {/* divider */}
                <div class="flex items-center justify-center gap-2 text-ink-secondary/50 text-xs py-1" aria-hidden="true">
                  <span class="flex-1 border-t border-dotted border-surface-border" />
                  <span>· Stats Summary ·</span>
                  <span class="flex-1 border-t border-dotted border-surface-border" />
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

                <p class="text-sm font-mono text-coin">Total: {totalXP()} XP</p>

                <p class="text-sm text-ink-secondary">
                  {d()?.totalNotes === 0 ? "Complete quests to earn XP" : `Earned ${gamification().xp} XP`}
                </p>

                <p class="text-sm text-ink-secondary flex items-center gap-1.5">
                  <span aria-hidden="true">📊</span> Log Status
                </p>

                <a
                  href="/profile"
                  class="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-border py-2 text-sm text-ink-secondary/80 hover:text-accent hover:border-accent/40 transition-colors"
                >
                  <span aria-hidden="true">→</span> View full profile
                </a>
              </div>
            </div>
          </section>

          {/* ─────────── BOTTOM: Today's Quests (spans middle+right) ─────────── */}
          <section class="lg:col-span-9 lg:col-start-4">
            <div class="rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm">
              <h2 class="font-display text-lg text-accent italic flex items-center gap-1.5 mb-3">
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
                          ? "bg-surface border border-accent/40 text-accent"
                          : "text-ink-secondary hover:text-ink-primary"
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
                      <div class="rounded-xl border border-surface-border bg-surface p-3 flex flex-col gap-2">
                        <h3 class="text-sm font-semibold text-ink-primary line-clamp-2">{q.title}</h3>
                        <div class="flex flex-wrap gap-1.5">
                          <span class="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-mono">
                            {q.questType}
                          </span>
                          <span class="px-2 py-0.5 rounded-full bg-coin/15 text-coin text-[10px] font-mono">
                            {q.xpReward} XP
                          </span>
                          <Show when={q.coinReward > 0}>
                            <span class="px-2 py-0.5 rounded-full bg-xp/15 text-xp text-[10px] font-mono">
                              +{q.coinReward} 🪙
                            </span>
                          </Show>
                        </div>
                        <a
                          href="/quests"
                          class={`mt-auto text-center text-xs font-semibold rounded-lg py-1.5 transition-colors ${
                            done()
                              ? "bg-surface-hover text-ink-secondary cursor-default"
                              : "bg-accent/15 text-accent hover:bg-accent/25"
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
                  class="rounded-xl border border-dashed border-surface-border flex items-center justify-center gap-1.5 p-6 text-sm text-ink-secondary/80 hover:text-accent hover:border-accent/40 transition-colors min-h-[7rem]"
                >
                  <span aria-hidden="true">+</span> All quests
                </a>
              </div>
            </div>
          </section>

          {/* ─────────── PATH-SPECIFIC WIDGETS ─────────── */}
          <Show when={authUser()?.path === "professional"}>
            <section class="lg:col-span-12">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Smart Inbox Digest */}
                <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-semibold text-ink-primary">Smart Inbox Digest</h3>
                    <button
                      onClick={loadDigest}
                      disabled={digestLoading()}
                      class="text-xs px-2 py-1 rounded-md bg-surface hover:bg-surface-hover text-ink-secondary transition-colors disabled:opacity-50"
                    >
                      {digestLoading() ? "Loading..." : "Refresh"}
                    </button>
                  </div>
                  <Show
                    when={digestData()}
                    fallback={<p class="text-sm text-ink-secondary/60 italic">Click Refresh to generate your daily digest</p>}
                  >
                    <p class="text-sm text-ink-primary leading-relaxed whitespace-pre-line">{digestData()}</p>
                  </Show>
                </div>
                {/* Focus Timer */}
                <FocusTimer />
              </div>
              {/* Projects */}
              <div class="mt-4">
                <ProjectList />
              </div>
            </section>
          </Show>

          <Show when={authUser()?.path === "journaler"}>
            <section class="lg:col-span-12">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MoodPicker />
                <GratitudeGarden />
              </div>
            </section>
          </Show>

          <Show when={authUser()?.path === "student"}>
            <section class="lg:col-span-12">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                  <h3 class="text-sm font-semibold text-ink-primary mb-3">⚔️ Active Bosses</h3>
                  <Show when={(bosses() || []).length > 0} fallback={
                    <div class="text-center py-6 text-ink-secondary">
                      <p class="text-3xl mb-2">👻</p>
                      <p class="text-sm">No active bosses. Keep writing to summon them!</p>
                    </div>
                  }>
                    <For each={(bosses() || []).slice(0, 2)}>{(boss: any) => (
                      <A href={`/boss/${boss.id}`} class="flex items-center gap-3 py-2 hover:bg-surface-hover rounded-lg px-2 transition-colors">
                        <span class="text-xl">{boss.bossEmoji || "👻"}</span>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-ink-primary truncate">{boss.bossName || boss.title}</p>
                          <div class="h-1.5 bg-surface-border rounded-full mt-1"><div class="h-full bg-error rounded-full" style={`width:${Math.round((boss.bossCurrentHp / boss.bossMaxHp) * 100)}%`} /></div>
                        </div>
                      </A>
                    )}</For>
                  </Show>
                </div>
                <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                  <h3 class="text-sm font-semibold text-ink-primary mb-3">🧠 Pending Quizzes</h3>
                  <Show when={(pendingQuizzes() || []).length > 0} fallback={
                    <div class="text-center py-6 text-ink-secondary">
                      <p class="text-3xl mb-2">📝</p>
                      <p class="text-sm">Write 100+ word notes to generate quizzes!</p>
                    </div>
                  }>
                    <For each={(pendingQuizzes() || []).slice(0, 3)}>{(q: any) => (
                      <A href="/quiz" class="flex items-center gap-3 py-2 hover:bg-surface-hover rounded-lg px-2 transition-colors">
                        <span class="text-lg">🧠</span>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm text-ink-primary truncate">Review #{q.reviewCount + 1}</p>
                          <p class="text-xs text-ink-secondary">{new Date(q.generatedAt).toLocaleDateString()}</p>
                        </div>
                      </A>
                    )}</For>
                  </Show>
                </div>
              </div>
            </section>
          </Show>
        </div>
      </div>
    </div>
  );
}

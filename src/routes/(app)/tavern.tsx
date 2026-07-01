import { createResource, createSignal, For, Show, onMount } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch, user as authUser } from "~/stores/auth";
import { gamification, xpProgressInLevel, dailyLimits, fetchDailyLimits } from "~/stores/user";
import { quests, fetchActiveQuests, type Quest } from "~/stores/quests";
import { getUnlockedFeatures, type UserPath } from "~/lib/path-unlocks";
import { t } from "~/lib/i18n";
import RadarChart, { type RadarStat } from "~/components/gamification/RadarChart";
import MoodPicker from "~/components/mood/MoodPicker";
import GratitudeGarden from "~/components/gratitude/GratitudeGarden";
import FocusTimer from "~/components/focus/FocusTimer";
import Nelar from "~/components/mascot/Nelar";
import StreakCalendar from "~/components/gamification/StreakCalendar";
import DailyCheckin from "~/components/gamification/DailyCheckin";
import DailyDigest from "~/components/gamification/DailyDigest";

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
    fetchDailyLimits();
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
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ─────────── BANNER: Full width ─────────── */}
        <header class="mb-6">
          <div class="relative rounded-xl overflow-hidden h-32 sm:h-44 bg-gradient-to-r from-accent/20 via-surface-elevated to-accent/10 border border-surface-border flex items-center justify-center">
            <div class="absolute inset-0 opacity-10" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, var(--color-accent) 10px, var(--color-accent) 11px);" />
            <div class="relative text-center">
              <p class="text-4xl sm:text-5xl">🏰</p>
              <p class="text-xs sm:text-sm text-ink-secondary/60 mt-1 font-display tracking-widest uppercase">
                {authUser()?.path === "student" ? t("Welcome back, scholar")
                : authUser()?.path === "professional" ? t("Welcome back, professional")
                : authUser()?.path === "journaler" ? t("Welcome back, chronicler")
                : t("Welcome back, adventurer")}
              </p>
            </div>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold text-ink-primary mt-4">{t("Tavern Hall")}</h1>
          <p class="text-sm text-ink-secondary mt-0.5">
            {authUser()?.path === "student" ? t("Your learning dashboard")
            : authUser()?.path === "professional" ? t("Your productivity command center")
            : authUser()?.path === "journaler" ? t("Your reflection sanctuary")
            : t("Your adventurer's dashboard")}
          </p>
        </header>

        {/* ─────────── 2-COLUMN DESKTOP LAYOUT ─────────── */}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ════ MAIN CONTENT (8 cols) ════ */}
          <main class="lg:col-span-8 space-y-5">

            {/* ── Avatar + Radar Chart row ── */}
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-5">
              {/* Avatar card */}
              <div class="sm:col-span-4">
                <div class="rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm h-full flex flex-col">
                  <div class="aspect-square rounded-xl overflow-hidden border border-surface-border bg-surface mb-3">
                    <Show
                      when={avatar()}
                      fallback={
                        <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-hover via-surface to-surface-elevated">
                          <span class="font-display text-5xl font-bold text-accent">{initial()}</span>
                        </div>
                      }
                    >
                      <img src={avatar()!} alt={`${name()}'s portrait`} class="w-full h-full object-cover" />
                    </Show>
                  </div>
                  <h2 class="font-display text-lg font-bold text-ink-primary text-center">{name()}</h2>
                  <p class="text-xs text-accent text-center font-semibold">{gamification().title}</p>

                  {/* Quick stats */}
                  <div class="mt-3 space-y-1.5 text-sm">
                    <div class="flex justify-between">
                      <span class="text-ink-secondary">{t("Streak:")}</span>
                      <span class="font-mono text-ink-primary">🔥 {gamification().streak} {t("days")}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-ink-secondary">{t("Coins:")}</span>
                      <span class="font-mono text-coin">{coins()}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-ink-secondary">{t("Total XP:")}</span>
                      <span class="font-mono text-accent">{totalXP()}</span>
                    </div>
                  </div>

                  {/* Level + XP bar */}
                  <div class="mt-3">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-xs font-mono text-accent">
                        {t("Level")} {lvl()}
                      </span>
                      <span class="font-mono text-ink-secondary">{xpPct()}%</span>
                    </div>
                    <div class="h-2 rounded-full bg-surface overflow-hidden">
                      <div class="h-full rounded-full bg-accent transition-all" style={{ width: `${xpPct()}%` }} />
                    </div>
                    <p class="text-[11px] text-ink-secondary mt-1 text-right font-mono">
                      {xpProg().current}/{xpProg().needed} XP
                    </p>
                  </div>
                </div>
              </div>

              {/* Radar Chart */}
              <div class="sm:col-span-8">
                <div class="rounded-2xl border border-surface-border bg-surface-elevated p-4 sm:p-6 shadow-sm h-full flex flex-col">
                  <p class="text-xs italic text-ink-secondary mb-2">{t("Stats Radar")}</p>
                  <div class="flex-1 flex items-center justify-center">
                    <Show when={d()?.totalNotes === 0} fallback={
                      <div class="w-full max-w-md">
                        <RadarChart stats={radarStats()} size={360} />
                      </div>
                    }>
                      <div class="text-center space-y-4 py-6">
                        <Nelar state="wave" size={56} class="mx-auto" />
                        <h3 class="text-lg font-bold text-ink-primary">{t("Your adventure begins!")}</h3>
                        <p class="text-sm text-ink-secondary max-w-xs mx-auto">{t("Write your first scroll to unlock your character stats, quests, and boss fights.")}</p>
                        <A href="/notes/new" class="inline-block px-6 py-2 bg-accent text-white rounded-lg font-medium text-sm">{t("Write Your First Scroll")}</A>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Today's Quests ── */}
            <div class="rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm">
              <h2 class="font-display text-lg text-accent italic flex items-center gap-1.5 mb-3">
                <span aria-hidden="true">🎮</span> {t("Today's Quests")} <span class="text-xs" aria-hidden="true">▼</span>
              </h2>

              {/* tabs */}
              <div class="flex items-center gap-1 mb-4 text-sm">
                <For
                  each={[
                    { id: "plan" as const, label: `📝 ${t("Plan")}` },
                    { id: "today" as const, label: `☀️ ${t("Today")}` },
                    { id: "done" as const, label: `✓ ${t("Done")}` },
                  ]}
                >
                  {(tab) => (
                    <button
                      type="button"
                      onClick={() => setQuestTab(tab.id)}
                      class={`px-3 py-1 rounded-full transition-colors ${
                        questTab() === tab.id
                          ? "bg-surface border border-accent/40 text-accent"
                          : "text-ink-secondary hover:text-ink-primary"
                      }`}
                      aria-pressed={questTab() === tab.id}
                    >
                      {tab.label}
                    </button>
                  )}
                </For>
              </div>

              {/* quest cards */}
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                          <span class="px-2 py-0.5 rounded-full bg-xp/15 text-xp text-[10px] font-mono">
                            {q.xpReward} XP
                          </span>
                          <Show when={q.coinReward > 0}>
                            <span class="px-2 py-0.5 rounded-full bg-coin/15 text-coin text-[10px] font-mono">
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
                          {done() ? t("Completed") : t("Complete")}
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
                  <span aria-hidden="true">+</span> {t("All quests")}
                </a>
              </div>
            </div>

            {/* ── PATH-SPECIFIC WIDGETS (in main) ── */}
            <Show when={authUser()?.path === "professional"}>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-semibold text-ink-primary">{t("Smart Inbox Digest")}</h3>
                    <button
                      onClick={loadDigest}
                      disabled={digestLoading()}
                      class="text-xs px-2 py-1 rounded-md bg-surface hover:bg-surface-hover text-ink-secondary transition-colors disabled:opacity-50"
                    >
                      {digestLoading() ? t("Loading...") : t("Refresh")}
                    </button>
                  </div>
                  <Show
                    when={digestData()}
                    fallback={<p class="text-sm text-ink-secondary/60 italic">{t("Click Refresh to generate your daily digest")}</p>}
                  >
                    <p class="text-sm text-ink-primary leading-relaxed whitespace-pre-line">{digestData()}</p>
                  </Show>
                </div>
                <FocusTimer />
              </div>
            </Show>

            <Show when={authUser()?.path === "journaler"}>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MoodPicker />
                <GratitudeGarden />
              </div>
            </Show>

            <Show when={authUser()?.path === "student"}>
              <Show when={getUnlockedFeatures(authUser()?.path as UserPath, gamification().level).length > 2}>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Show when={getUnlockedFeatures(authUser()?.path as UserPath, gamification().level).includes("Boss Fight")}>
                    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                      <h3 class="text-sm font-semibold text-ink-primary mb-3">⚔️ {t("Active Bosses")}</h3>
                      <Show when={(bosses() || []).length > 0} fallback={
                        <div class="text-center py-6 text-ink-secondary">
                          <Nelar state="idle" size={48} class="mx-auto mb-2" />
                          <p class="text-sm">{t("No active bosses. Keep writing to summon them!")}</p>
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
                  </Show>
                  <Show when={getUnlockedFeatures(authUser()?.path as UserPath, gamification().level).includes("AI Quiz")}>
                    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
                      <h3 class="text-sm font-semibold text-ink-primary mb-3">🧠 {t("Pending Quizzes")}</h3>
                      <Show when={(pendingQuizzes() || []).length > 0} fallback={
                        <div class="text-center py-6 text-ink-secondary">
                          <Nelar state="curious" size={48} class="mx-auto mb-2" />
                          <p class="text-sm">{t("Write 100+ word notes to generate quizzes!")}</p>
                        </div>
                      }>
                        <For each={(pendingQuizzes() || []).slice(0, 3)}>{(q: any) => (
                          <A href="/quiz" class="flex items-center gap-3 py-2 hover:bg-surface-hover rounded-lg px-2 transition-colors">
                            <span class="text-lg">🧠</span>
                            <div class="flex-1 min-w-0">
                              <p class="text-sm text-ink-primary truncate">{t("Review #")}{q.reviewCount + 1}</p>
                              <p class="text-xs text-ink-secondary">{new Date(q.generatedAt).toLocaleDateString()}</p>
                            </div>
                          </A>
                        )}</For>
                      </Show>
                    </div>
                  </Show>
                </div>
              </Show>
            </Show>

          </main>

          {/* ════ SIDEBAR (4 cols) ════ */}
          <aside class="lg:col-span-4 space-y-4">

            {/* ── Today's Progress ── */}
            <div class="rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-surface-border text-xs text-accent mb-3">
                <span aria-hidden="true">☀️</span> {t("Today")}
              </span>

              <h2 class="font-display text-lg text-ink-primary mb-3">{weekday()}</h2>

              <div class="flex items-center gap-2 mb-3">
                <span class="text-xs text-ink-secondary">{t("Progress:")}</span>
                <span class="font-mono tracking-tight text-accent" role="progressbar" aria-valuenow={progressPct()} aria-valuemin={0} aria-valuemax={100}>
                  <For each={[0, 1, 2, 3, 4, 5]}>
                    {(i) => <span aria-hidden="true">{i < filledSquares() ? "▰" : "▱"}</span>}
                  </For>
                </span>
                <span class="font-mono text-sm text-accent">{progressPct()}%</span>
              </div>

              <p class="text-sm italic text-ink-secondary">
                {t("You've gained")} <span class="font-mono not-italic text-accent">{xpToday()}</span> {t("XP today.")}
              </p>
              <p class="text-sm italic text-ink-secondary">
                {t("You've completed")} <span class="font-mono not-italic text-accent">{tasksToday()}</span> {t("tasks today.")}
              </p>

              <Show when={dailyLimits()}>
                <div class="mt-3 p-2.5 rounded-lg bg-surface border border-surface-border text-xs space-y-1.5">
                  <div class="flex justify-between text-ink-secondary">
                    <span>{t("Daily XP remaining")}</span>
                    <span class="font-mono text-accent">{dailyLimits()!.xpRemaining} / {dailyLimits()!.effectiveXpCap}</span>
                  </div>
                  <div class="h-1.5 bg-surface-border rounded-full overflow-hidden">
                    <div
                      class="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((dailyLimits()!.effectiveXpCap - dailyLimits()!.xpRemaining) / dailyLimits()!.effectiveXpCap) * 100)}%` }}
                    />
                  </div>
                  <div class="flex justify-between text-ink-secondary">
                    <span>{t("Daily coins remaining")}</span>
                    <span class="font-mono text-coin">{dailyLimits()!.coinsRemaining} / {dailyLimits()!.effectiveCoinCap}</span>
                  </div>
                </div>
              </Show>

              <a
                href="/notes/new"
                class="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-border py-2 text-sm text-ink-secondary/80 hover:text-accent hover:border-accent/40 transition-colors"
              >
                <span aria-hidden="true">+</span> {t("New scroll")}
              </a>
            </div>

            {/* ── Daily Check-in ── */}
            <DailyCheckin />

            {/* ── Daily Digest ── */}
            <DailyDigest />

            {/* ── Streak Calendar ── */}
            <StreakCalendar />

            {/* ── View Profile link ── */}
            <a
              href="/profile"
              class="block w-full text-center rounded-xl border border-dashed border-surface-border py-2.5 text-sm text-ink-secondary/80 hover:text-accent hover:border-accent/40 transition-colors"
            >
              {t("View full profile")} →
            </a>

          </aside>

        </div>
      </div>
    </div>
  );
}

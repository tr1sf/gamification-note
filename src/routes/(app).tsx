import { Show, onMount, onCleanup, createEffect, type JSX } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { user, loading, initAuth, logout, authFetch } from "~/stores/auth";
import { uiStore, toggleSidebar, setTheme } from "~/stores/ui";
import { gamification, syncFromUser } from "~/stores/user";
import { quests, fetchActiveQuests } from "~/stores/quests";
import { addSocketNotification, type Notification } from "~/stores/notifications";
import { useSocket } from "~/lib/socket/client";
import { ToastContainer } from "~/components/ui/Toast";
import XPBar from "~/components/gamification/XPBar";
import LevelBadge from "~/components/gamification/LevelBadge";
import CoinDisplay from "~/components/gamification/CoinDisplay";
import StreakTracker from "~/components/gamification/StreakTracker";
import QuestProgress from "~/components/gamification/QuestProgress";
import RewardPopup from "~/components/gamification/RewardPopup";
import LevelUpModal from "~/components/gamification/LevelUpModal";
import NotificationBell from "~/components/shared/NotificationBell";
import SurveyWidget from "~/components/survey/SurveyWidget";
import InstallPrompt from "~/components/pwa/InstallPrompt";
import { getUnlockedFeatures, getNextUnlock, PATH_UNLOCKS, type UserPath } from "~/lib/path-unlocks";
import { applyThemeVariables, restoreThemeVariables, clearThemeVariables } from "~/lib/themes/defaults";
import { getCurrentLang, applyLanguage, t } from "~/lib/i18n";

export default function AppLayout(props: { children?: JSX.Element }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { on, off, connected } = useSocket();
  const isOnboarding = () => location.pathname === "/onboarding";

  onMount(() => {
    initAuth();
  });

  createEffect(() => {
    const u = user();
    if (u && connected()) {
      const handleNotification = (data: Notification) => {
        addSocketNotification(data);
      };
      on("notification:new", handleNotification);
      return () => {
        off("notification:new", handleNotification);
      };
    }
  });

  createEffect(() => {
    if (!loading() && !user()) {
      navigate("/login");
    }
  });

  createEffect(() => {
    const u = user();
    const allowed = ["/onboarding", "/notes/new", "/profile"];
    if (u && !u.onboardingCompleted && !allowed.some(p => location.pathname.startsWith(p))) {
      navigate("/onboarding");
    }
  });

  createEffect(() => {
    const u = user();
    if (u) {
      syncFromUser({ xp: u.xp, coins: u.coins, level: u.level, title: u.title, streak: u.streak, gamificationStyle: u.gamificationStyle });
      fetchActiveQuests();
      // Auto nudge after login
      authFetch("/api/auth/nudge").catch(() => {});
      // Restore equipped theme
      restoreEquippedTheme().catch(() => {});
    }
  });

  // Nudge heartbeat — periodic health check every 30 min
  onMount(() => {
    const interval = setInterval(() => {
      if (user()) {
        authFetch("/api/auth/nudge").catch(() => {});
      }
    }, 30 * 60 * 1000);
    onCleanup(() => clearInterval(interval));
  });

  const g = () => gamification();
  const style = () => g().gamificationStyle ?? "balanced";
  const isMinimal = () => style() === "minimal";
  const isSolo = () => style() === "solo";

  const userPath = () => (user()?.path as UserPath | undefined) || null;
  const unlockedFeatures = () => getUnlockedFeatures(userPath(), g().level);
  const nextUnlock = () => getNextUnlock(userPath(), g().level);
  const isUnlocked = (feature: string) => unlockedFeatures().includes(feature);

  async function restoreEquippedTheme() {
    restoreThemeVariables();
  }

  return (
    <Show when={!loading() && user()} fallback={
      <div class="min-h-screen bg-surface flex items-center justify-center">
        <div class="text-center space-y-4">
          <div class="w-20 h-20 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center animate-pulse">
            <span class="text-4xl">🏰</span>
          </div>
          <h1 class="text-xl font-display font-bold text-ink-primary">TavernoteX</h1>
          <p class="text-sm text-ink-secondary">{t("The tavern doors are opening...")}</p>
          <div class="flex gap-1 justify-center">
            <div class="w-2 h-2 rounded-full bg-accent animate-bounce" style="animation-delay:0s" />
            <div class="w-2 h-2 rounded-full bg-accent animate-bounce" style="animation-delay:0.15s" />
            <div class="w-2 h-2 rounded-full bg-accent animate-bounce" style="animation-delay:0.3s" />
          </div>
        </div>
      </div>
    }>
      <Show when={isOnboarding()} fallback={
        <>
          <ToastContainer />
          <RewardPopup />
          <LevelUpModal />
          <SurveyWidget />
          <InstallPrompt />
      <div class="flex h-screen overflow-hidden bg-surface">
        {/* Sidebar */}
        <aside class={`${uiStore.sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-surface-elevated border-r border-surface-border flex flex-col transition-transform duration-200`} style="box-shadow: inset -1px 0 0 color-mix(in oklab, var(--color-accent) 6%, transparent);">
          <div class="relative p-4 border-b border-surface-border">
            <div class="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" aria-hidden="true" />
            <h1 class="text-xl font-display font-bold text-ink-primary">TavernoteX</h1>
            <p class="text-xs text-ink-secondary/60 mt-0.5">{t("Your tavern of knowledge")}</p>
          </div>
          <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
            <div class="px-3 py-1.5 mb-1">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">{t("Main Hall")}</p>
            </div>
            <NavItem href="/tavern" icon="🏰" label={t("Tavern Hall")} />
            <div class="px-3 py-1.5 mb-1 mt-2">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">{t("Scrolls")}</p>
            </div>
            <NavItem href="/notes" icon="📜" label={t("My Scrolls")} />
            <NavItem href="/notes/new" icon="🖊️" label={t("New Scroll")} />
            <div class="px-3 py-1.5 mb-1 mt-2">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">{t("Adventures")}</p>
            </div>
            <NavItem href="/boss/active" icon={isUnlocked("Boss Fight") ? "⚔️" : "🔒"} label={isUnlocked("Boss Fight") ? t("Boss Fight") : `${t("Boss")} (Lv.${PATH_UNLOCKS[userPath() ?? "student"]?.find(f => f.feature === "Boss Fight")?.level ?? 7}+)`} locked={!isUnlocked("Boss Fight")} />
            <NavItem href="/quiz" icon={isUnlocked("AI Quiz") || isUnlocked("Spaced Repetition") ? "🧠" : "🔒"} label={isUnlocked("AI Quiz") ? t("Quiz Review") : `${t("Quiz")} (Lv.${PATH_UNLOCKS[userPath() ?? "student"]?.find(f => f.feature === "AI Quiz")?.level ?? 4}+)`} locked={!isUnlocked("AI Quiz") && !isUnlocked("Spaced Repetition")} />
            <NavItem href="/minigames/potion" icon="🧪" label={t("Potion Match")} />
            <NavItem href="/quests" icon="📋" label={t("Quests")} />
            <Show when={!isSolo()}>
              <NavItem href="/guilds" icon={isUnlocked("Guilds") ? "🏛️" : "🔒"} label={isUnlocked("Guilds") ? t("Guilds") : `${t("Guilds")} (Lv.${PATH_UNLOCKS[userPath() ?? "student"]?.find(f => f.feature === "Guilds")?.level ?? 10}+)`} locked={!isUnlocked("Guilds")} />
            </Show>
            <NavItem href="/progress" icon="📊" label={t("Progress")} />
            <NavItem href="/insights" icon="💡" label={t("Insights")} />
            <div class="px-3 py-1.5 mb-1 mt-2">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">{t("Account")}</p>
            </div>
            <NavItem href="/profile" icon="🛡️" label={t("Profile")} />
            <NavItem href="/shop" icon="🏪" label={t("Shop")} />
            <NavItem href="/analytics" icon="📊" label={t("Analytics")} />
          </nav>
          <div class="p-3 border-t border-surface-border space-y-2 bg-surface-hover/30">
            <QuestProgress quests={quests()} />
          </div>
          <div class="p-4 border-t border-surface-border bg-surface-hover/20">
              <Show when={user()}>
              {(u) => (
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent ring-2 ring-accent/10 overflow-hidden" aria-label={u().username}>
                    {u().avatarUrl ? (
                      <img src={u().avatarUrl!} alt={u().username} class="w-full h-full object-cover" />
                    ) : (
                      <img src="/assets/images/default-avatar.png" alt="Default avatar" class="w-full h-full object-cover" />
                    )}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-ink-primary truncate">{u().username}</p>
                    <p class="text-xs text-ink-secondary">Lv.{g().level} {g().title}</p>
                    <Show when={nextUnlock()}>
                      {(nu) => (
                        <p class="text-[0.6rem] text-accent/60 mt-0.5" title={t("Unlocks at a higher level")}>{t("Next:")} {t(nu().feature)} {t("at")} Lv.{nu().level}</p>
                      )}
                    </Show>
                  </div>
                  <button onClick={async () => { await logout(); navigate("/login"); }} class="text-xs text-ink-secondary/70 hover:text-error transition-colors px-1.5 py-0.5 rounded hover:bg-error/5" title={t("Exit tavern")}>{t("Exit tavern")}</button>
                </div>
              )}
            </Show>
            {/* Language toggle */}
            <div class="mt-2 pt-2 border-t border-surface-border/30">
              <button
                onClick={async () => {
                  const next = getCurrentLang() === "en" ? "vi" : "en";
                  applyLanguage(next);
                  // Persist to account so it survives login/logout cycles.
                  await authFetch("/api/users/language", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lang: next }),
                  }).catch(() => {});
                  window.location.reload();
                }}
                class="text-xs text-ink-secondary/50 hover:text-ink-secondary transition-colors flex items-center gap-1"
                title={getCurrentLang() === "en" ? "Switch to Tiếng Việt" : "Switch to English"}
              >
                <span class="text-sm">{getCurrentLang() === "en" ? "🇻🇳" : "🇬🇧"}</span>
                <span>{getCurrentLang() === "en" ? "Tiếng Việt" : "English"}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        <Show when={uiStore.sidebarOpen}>
          <div class="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={toggleSidebar} />
        </Show>

        {/* Main content */}
        <div class="flex-1 flex flex-col min-w-0">
          <header class="h-14 border-b border-surface-border bg-surface flex items-center gap-2 sm:gap-3 px-3 sm:px-4 shrink-0 relative">
            <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/10 to-transparent" aria-hidden="true" />
            <button
              class="lg:hidden p-2 text-ink-secondary hover:text-ink-primary"
              onClick={toggleSidebar}
              aria-label={uiStore.sidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={uiStore.sidebarOpen}
            >
              ☰
            </button>

            <div class="hidden sm:block">
              <Show when={!isMinimal()}>
                <XPBar xp={g().xp} level={g().level} compact />
              </Show>
            </div>

            <div class="flex-1" />

            <Show when={g().streak > 0}>
              <StreakTracker streak={g().streak} compact />
            </Show>

            <LevelBadge level={g().level} title={g().title} />

            <CoinDisplay coins={g().coins} compact />

            <NotificationBell />

            <button
              class="text-sm text-ink-secondary hover:text-ink-primary p-1.5 rounded-md hover:bg-surface-hover transition-colors"
              onClick={() => {
                const next = uiStore.theme === "dark" ? "light" : "dark";
                setTheme(next);
                if (next === "light") clearThemeVariables();
                else restoreThemeVariables();
              }}
              aria-label={`Switch to ${uiStore.theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${uiStore.theme === "dark" ? "light" : "dark"} mode`}
            >
              {uiStore.theme === "dark" ? "☀️" : "🌙"}
            </button>
          </header>
          <main class="flex-1 overflow-auto" id="main-content">
            {props.children}
          </main>
        </div>
      </div>
        </>
      }>
        {props.children}
      </Show>
    </Show>
  );
}

function NavItem(props: { href: string; icon: string; label: string; locked?: boolean }) {
  const location = useLocation();
  const isActive = () => !props.locked && location.pathname.startsWith(props.href);
  const content = (
    <>
      <span class={`${props.locked ? "text-ink-secondary/30" : isActive() ? "text-accent" : "text-ink-secondary/60"} transition-transform duration-200 ${!props.locked && "group-hover:scale-110"}`} aria-hidden="true"
        style={isActive() && !props.locked ? "filter: drop-shadow(0 0 4px color-mix(in oklab, var(--color-accent) 30%, transparent));" : ""}>
        {props.icon}
      </span>
      <span class="flex-1">{props.label}</span>
    </>
  );
  if (props.locked) {
    return (
      <div class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-ink-secondary/30 cursor-not-allowed bg-surface-hover/10" title={t("Unlocks at a higher level")}>
        {content}
      </div>
    );
  }
  return (
    <a
      href={props.href}
      class={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 relative ${
        isActive()
          ? "bg-accent/10 text-accent shadow-sm"
          : "text-ink-secondary hover:bg-surface-hover hover:text-ink-primary"
      }`}
      aria-current={isActive() ? "page" : undefined}
    >
      {content}
      <span
        class={`absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-accent transition-all duration-200 ${
          isActive() ? "opacity-100" : "opacity-0 group-hover:opacity-30"
        }`}
        aria-hidden="true"
      />
    </a>
  );
}

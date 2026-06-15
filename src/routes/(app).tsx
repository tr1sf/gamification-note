import { Show, onMount, createEffect, type JSX } from "solid-js";
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
import SurveyWidget from "~/components/survey/SurveyWidget";
import NotificationBell from "~/components/shared/NotificationBell";

export default function AppLayout(props: { children?: JSX.Element }) {
  const navigate = useNavigate();
  const { on, off, connected } = useSocket();

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
    if (u) {
      syncFromUser({ xp: u.xp, coins: u.coins, level: u.level, title: u.title, streak: u.streak, gamificationStyle: (u as any).gamificationStyle });
      fetchActiveQuests();
      // Auto nudge after login
      authFetch("/api/auth/nudge").catch(() => {});
    }
  });

  const g = () => gamification();
  const style = () => g().gamificationStyle ?? "balanced";
  const isMinimal = () => style() === "minimal";
  const isSolo = () => style() === "solo";

  return (
    <Show when={!loading() && user()} fallback={
      <div class="min-h-screen flex flex-col bg-surface">
        <div class="min-h-screen flex">
        <div class="hidden lg:block w-64 bg-surface-elevated border-r border-surface-border p-4 space-y-4">
          <div class="h-7 w-32 bg-surface-border rounded animate-pulse" />
          <div class="space-y-3 mt-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div class="h-8 bg-surface-hover rounded-md" style="animation: shimmer 1.5s infinite linear; background: linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-surface-border) 50%, var(--color-surface-hover) 75%); background-size: 200% 100%;" />
            ))}
          </div>
        </div>
        <div class="flex-1 flex flex-col">
          <div class="h-14 border-b border-surface-border bg-surface px-4 flex items-center gap-3">
            <div class="h-5 w-5 bg-surface-border rounded lg:hidden" />
            <div class="flex-1" />
            <div class="h-8 w-8 bg-surface-border rounded-full" />
            <div class="h-8 w-8 bg-surface-border rounded-full" />
            <div class="h-8 w-8 bg-surface-border rounded-full" />
          </div>
          <div class="flex-1 p-6 space-y-4">
            <div class="h-8 w-48 bg-surface-border rounded animate-pulse" />
            <div class="h-4 w-64 bg-surface-border rounded animate-pulse" />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {[1, 2, 3, 4].map((i) => (
                <div class="h-32 bg-surface-border rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    }>
      <ToastContainer />
      <RewardPopup />
      <LevelUpModal />
      <SurveyWidget />
      <div class="flex h-screen overflow-hidden bg-surface">
        {/* Sidebar */}
        <aside class={`${uiStore.sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-surface-elevated border-r border-surface-border flex flex-col transition-transform duration-200`} style="box-shadow: inset -1px 0 0 color-mix(in oklab, var(--color-accent) 6%, transparent);">
          <div class="relative p-4 border-b border-surface-border">
            <div class="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" aria-hidden="true" />
            <h1 class="text-xl font-display font-bold text-ink-primary">TavernoteX</h1>
            <p class="text-xs text-ink-secondary/60 mt-0.5">Your tavern of knowledge</p>
          </div>
          <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
            <div class="px-3 py-1.5 mb-1">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">Main Hall</p>
            </div>
            <NavItem href="/tavern" icon="🏰" label="Tavern Hall" />
            <div class="px-3 py-1.5 mb-1 mt-2">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">Scrolls</p>
            </div>
            <NavItem href="/notes" icon="📜" label="My Scrolls" />
            <NavItem href="/notes/new" icon="🖊️" label="New Scroll" />
            <div class="px-3 py-1.5 mb-1 mt-2">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">Adventures</p>
            </div>
            <NavItem href="/boss/active" icon="⚔️" label="Boss Fight" />
            <NavItem href="/challenges" icon="🏆" label="Challenges" />
            <NavItem href="/quiz" icon="🧠" label="Quiz Review" />
            <NavItem href="/habits" icon="🔥" label="Daily Rituals" />
            <NavItem href="/quests" icon="📋" label="Quests" />
            <NavItem href="/ai-quests" icon="🎯" label="AI Quests" />
            <Show when={!isSolo()}>
              <NavItem href="/guilds" icon="🏛️" label="Guilds" />
            </Show>
            <NavItem href="/progress" icon="📊" label="Progress" />
            <NavItem href="/insights" icon="💡" label="Insights" />
            <div class="px-3 py-1.5 mb-1 mt-2">
              <p class="text-[0.65rem] font-semibold tracking-widest uppercase text-ink-secondary/50">Account</p>
            </div>
            <NavItem href="/profile" icon="🛡️" label="Profile" />
            <NavItem href="/shop" icon="🏪" label="Shop" />
            <NavItem href="/analytics" icon="📊" label="Analytics" />
          </nav>
          <div class="p-3 border-t border-surface-border space-y-2 bg-surface-hover/30">
            <QuestProgress quests={quests()} />
          </div>
          <div class="p-4 border-t border-surface-border bg-surface-hover/20">
            <Show when={user()}>
              {(u) => (
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent ring-2 ring-accent/10" aria-label={u().username}>
                    {u().username.charAt(0).toUpperCase()}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-ink-primary truncate">{u().username}</p>
                    <p class="text-xs text-ink-secondary">Lv.{g().level} {g().title}</p>
                  </div>
                  <button onClick={async () => { await logout(); navigate("/login"); }} class="text-xs text-ink-secondary/70 hover:text-error transition-colors px-1.5 py-0.5 rounded hover:bg-error/5" title="Exit tavern">Exit</button>
                </div>
              )}
            </Show>
          </div>
        </aside>

        {/* Overlay for mobile */}
        <Show when={uiStore.sidebarOpen}>
          <div class="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={toggleSidebar} />
        </Show>

        {/* Main content */}
        <div class="flex-1 flex flex-col min-w-0">
          <header class="h-14 border-b border-surface-border bg-surface flex items-center gap-3 px-4 shrink-0 relative">
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
              onClick={() => setTheme(uiStore.theme === "dark" ? "light" : "dark")}
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
    </Show>
  );
}

function NavItem(props: { href: string; icon: string; label: string }) {
  const location = useLocation();
  const isActive = () => location.pathname.startsWith(props.href);
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
      <span
        class={`transition-transform duration-200 group-hover:scale-110 ${isActive() ? "text-accent" : "text-ink-secondary/60 group-hover:text-ink-secondary"}`}
        aria-hidden="true"
        style={isActive() ? "filter: drop-shadow(0 0 4px color-mix(in oklab, var(--color-accent) 30%, transparent));" : ""}
      >
        {props.icon}
      </span>
      {props.label}
      <span
        class={`absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-accent transition-all duration-200 ${
          isActive() ? "opacity-100" : "opacity-0 group-hover:opacity-30"
        }`}
        aria-hidden="true"
      />
    </a>
  );
}

import { Show, onMount, createEffect } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { user, loading, initAuth, logout } from "~/stores/auth";
import { uiStore, toggleSidebar, setTheme } from "~/stores/ui";
import { ToastContainer } from "~/components/ui/Toast";

export default function AppLayout(props: { children: unknown }) {
  const navigate = useNavigate();

  onMount(() => {
    initAuth();
  });

  createEffect(() => {
    if (!loading() && !user()) {
      navigate("/login");
    }
  });

  return (
    <Show when={!loading() && user()} fallback={
      <div class="min-h-screen flex items-center justify-center bg-surface">
        <div class="animate-pulse text-ink-secondary text-lg">Loading tavern...</div>
      </div>
    }>
      <ToastContainer />
      <div class="flex h-screen overflow-hidden bg-surface">
        {/* Sidebar */}
        <aside class={`${uiStore.sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-surface-elevated border-r border-surface-border flex flex-col transition-transform duration-200`}>
          <div class="p-4 border-b border-surface-border">
            <h1 class="text-xl font-display font-bold text-ink-primary">TavernoteX</h1>
          </div>
          <nav class="flex-1 p-3 space-y-1" aria-label="Main navigation">
            <NavItem href="/tavern" icon="🏰" label="Tavern Hall" />
            <NavItem href="/notes" icon="📜" label="My Scrolls" />
            <NavItem href="/notes/new" icon="🖊️" label="New Scroll" />
          </nav>
          <div class="p-4 border-t border-surface-border">
            <Show when={user()}>
              {(u) => (
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold" aria-label={u().username}>
                    {u().username.charAt(0).toUpperCase()}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-ink-primary truncate">{u().username}</p>
                    <p class="text-xs text-ink-secondary">Lv.{u().level} {u().title}</p>
                  </div>
                  <button onClick={async () => { await logout(); navigate("/login"); }} class="text-xs text-ink-secondary hover:text-error">Exit</button>
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
          <header class="h-14 border-b border-surface-border bg-surface flex items-center justify-between px-4 shrink-0">
            <button
              class="lg:hidden p-2 text-ink-secondary hover:text-ink-primary"
              onClick={toggleSidebar}
              aria-label={uiStore.sidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={uiStore.sidebarOpen}
            >
              ☰
            </button>
            <div class="flex-1" />
            <button
              class="text-sm text-ink-secondary hover:text-ink-primary p-1"
              onClick={() => setTheme(uiStore.theme === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode"
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
      class={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
        isActive()
          ? "bg-accent/10 text-accent font-medium"
          : "text-ink-secondary hover:bg-surface-hover hover:text-ink-primary"
      }`}
      aria-current={isActive() ? "page" : undefined}
    >
      <span aria-hidden="true">{props.icon}</span>
      {props.label}
    </a>
  );
}

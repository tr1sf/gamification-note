import { createSignal, createResource, Show, onMount } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch, user as authUser, loading as authLoading } from "~/stores/auth";
import { syncFromUser, gamification } from "~/stores/user";
import { addToast } from "~/stores/ui";
import CharacterSheet from "~/components/profile/CharacterSheet";
import StatsPanel from "~/components/profile/StatsPanel";
import AchievementList, { type Achievement } from "~/components/profile/AchievementList";
import InventoryPanel, { type InventoryItem } from "~/components/profile/InventoryPanel";
import { t } from "~/lib/i18n";

interface DashboardData {
  stats: Array<{ label: string; value: string | number; icon: string }>;
  achievements: Achievement[];
  inventory: InventoryItem[];
}

async function fetchDashboard(): Promise<DashboardData | null> {
  try {
    const res = await authFetch("/api/stats/dashboard");
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = createSignal<"stats" | "achievements" | "inventory">("stats");
  const [dashboard, { refetch }] = createResource(fetchDashboard);
  const loaded = createSignal(false);

  onMount(async () => {
    if (!authLoading()) {
      const u = authUser();
      if (u) {
        syncFromUser({ xp: u.xp, coins: u.coins, level: u.level, title: u.title });
      }
    }
  });

  const tabs = [
    { id: "stats" as const, label: t("Stats"), icon: "📊" },
    { id: "achievements" as const, label: t("Achievements"), icon: "🏆" },
    { id: "inventory" as const, label: t("Inventory"), icon: "🎒" },
  ];

  const userData = () => authUser();
  const g = () => gamification();

  return (
    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <Show when={userData() && !authLoading()} fallback={
        <div class="animate-pulse text-ink-secondary py-12 text-center">{t("Loading profile...")}</div>
      }>
        <CharacterSheet
          username={userData()!.username}
          avatarUrl={userData()!.avatarUrl}
          userPath={userData()!.path}
          inventory={dashboard()?.inventory}
        />

        <div class="flex flex-wrap items-center gap-2">
          <A href="/settings/security" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-sm text-ink-secondary hover:border-accent hover:text-accent transition-colors">
            <span aria-hidden="true">🔐</span> {t("Account security")}
          </A>
          <A href="/settings/gamification" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-sm text-ink-secondary hover:border-accent hover:text-accent transition-colors">
            <span aria-hidden="true">⚔️</span> Gamification Style
          </A>
          <A href="/settings/path" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-sm text-ink-secondary hover:border-accent hover:text-accent transition-colors">
            <span aria-hidden="true">🎓</span> Your Path
          </A>
          <A href="/settings/notifications" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-sm text-ink-secondary hover:border-accent hover:text-accent transition-colors">
            <span aria-hidden="true">🔔</span> {t("Notifications")}
          </A>
        </div>

        <div class="flex gap-1 border-b border-surface-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              onClick={() => setActiveTab(tab.id)}
              class={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                activeTab() === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <span aria-hidden="true" class="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <Show
          when={!dashboard.loading}
          fallback={
            <div class="space-y-4">
              <div class="h-40 bg-surface-border rounded-xl animate-pulse" />
              <div class="h-40 bg-surface-border rounded-xl animate-pulse" />
            </div>
          }
        >
          <Show when={dashboard.error || !dashboard()}>
            <div class="text-center py-8">
              <p class="text-error text-sm">{t("Failed to load profile data")}</p>
              <button onClick={() => refetch()} class="text-accent hover:underline text-sm mt-2">{t("Try again")}</button>
            </div>
          </Show>

          <Show when={dashboard()}>
            <Show when={activeTab() === "stats"}>
              <StatsPanel stats={dashboard()!.stats} />
            </Show>
            <Show when={activeTab() === "achievements"}>
              <AchievementList achievements={dashboard()!.achievements} />
            </Show>
            <Show when={activeTab() === "inventory"}>
              <InventoryPanel items={dashboard()!.inventory} onRefresh={() => refetch()} />
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

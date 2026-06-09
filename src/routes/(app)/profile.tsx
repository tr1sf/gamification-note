import { createSignal, createResource, Show, onMount } from "solid-js";
import { authFetch, user as authUser, loading as authLoading } from "~/stores/auth";
import { syncFromUser, gamification } from "~/stores/user";
import { addToast } from "~/stores/ui";
import CharacterSheet from "~/components/profile/CharacterSheet";
import StatsPanel from "~/components/profile/StatsPanel";
import AchievementList, { type Achievement } from "~/components/profile/AchievementList";
import InventoryPanel, { type InventoryItem } from "~/components/profile/InventoryPanel";

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
    { id: "stats" as const, label: "Stats", icon: "📊" },
    { id: "achievements" as const, label: "Achievements", icon: "🏆" },
    { id: "inventory" as const, label: "Inventory", icon: "🎒" },
  ];

  const userData = () => authUser();
  const g = () => gamification();

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <Show when={userData() && !authLoading()} fallback={
        <div class="animate-pulse text-ink-secondary py-12 text-center">Loading profile...</div>
      }>
        <CharacterSheet
          username={userData()!.username}
          avatarUrl={userData()!.avatarUrl}
        />

        <div class="flex gap-1 border-b border-surface-border">
          {tabs.map((tab) => (
            <button
              onClick={() => setActiveTab(tab.id)}
              class={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
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
              <p class="text-error text-sm">Failed to load profile data</p>
              <button onClick={() => refetch()} class="text-accent hover:underline text-sm mt-2">Try again</button>
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
              <InventoryPanel items={dashboard()!.inventory} />
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

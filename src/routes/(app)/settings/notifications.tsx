import { createResource, createSignal, For, Show } from "solid-js";
import { authFetch } from "~/stores/auth";

const TOGGLES = [
  { key: "desktop", label: "Desktop notifications", desc: "Show system notifications when tab is hidden" },
  { key: "quest_complete", label: "Quest completed", desc: "Notify when you finish a quest" },
  { key: "level_up", label: "Level up", desc: "Celebrate level-up moments" },
  { key: "streak_warning", label: "Streak warnings", desc: "Warn when your streak is at risk", locked: true },
  { key: "guild_activity", label: "Guild activity", desc: "New messages and tasks in your guilds" },
  { key: "weekly_recap", label: "Weekly recap", desc: "Sunday summary of your productivity" },
];

export default function NotificationSettings() {
  const [prefs, { refetch }] = createResource(async () => {
    const res = await authFetch("/api/users/notification-prefs");
    const json = await res.json();
    return json.success ? json.data : {};
  });
  const [saving, setSaving] = createSignal<string | null>(null);

  const toggle = async (key: string, value: boolean) => {
    setSaving(key);
    const newPrefs = { ...prefs(), [key]: value };
    await authFetch("/api/users/notification-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPrefs),
    });
    refetch();
    setSaving(null);
  };

  return (
    <div class="max-w-xl mx-auto p-6 space-y-6">
      <h1 class="text-2xl font-display font-bold text-ink-primary">Notification Settings</h1>
      <div class="space-y-3">
        <For each={TOGGLES}>{(item) => {
          const isOn = () => !item.locked && (prefs()?.[item.key] !== false);
          return (
            <div class="flex items-center justify-between p-4 bg-surface-elevated rounded-xl border border-surface-border">
              <div>
                <p class="text-sm font-medium text-ink-primary">{item.label} {item.locked ? "🔒" : ""}</p>
                <p class="text-xs text-ink-secondary mt-0.5">{item.desc}</p>
              </div>
              <button
                onClick={() => !item.locked && toggle(item.key, !isOn())}
                disabled={saving() === item.key || item.locked}
                class={`w-12 h-6 rounded-full transition-colors relative ${isOn() ? "bg-accent" : "bg-surface-border"} ${item.locked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${isOn() ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
          );
        }}</For>
      </div>
    </div>
  );
}

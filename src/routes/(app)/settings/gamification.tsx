import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch, user } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { t } from "~/lib/i18n";

const STYLES = [
  {
    id: "competitive",
    name: "Adventurer",
    icon: "⚔️",
    desc: "Maximize XP, bosses, and leaderboards. See every stat.",
    features: ["XP bar always visible", "Boss fights front and center", "Leaderboard emphasis", "Full HUD"],
  },
  {
    id: "balanced",
    name: "Balanced",
    icon: "⚖️",
    desc: "The default tavern experience. All features, moderate emphasis.",
    features: ["All features visible", "No hidden content", "Standard HUD"],
  },
  {
    id: "collaborative",
    name: "Collaborator",
    icon: "🤝",
    desc: "Focus on guild goals and shared progress. Less competition.",
    features: ["Guilds emphasized", "No leaderboard noise", "Shared goal focus"],
  },
  {
    id: "solo",
    name: "Solo Scholar",
    icon: "📖",
    desc: "No guilds, no social pressure. Pure personal knowledge journey.",
    features: ["Guilds hidden", "No leaderboard", "Quiet, focused experience"],
  },
  {
    id: "minimal",
    name: "Minimalist",
    icon: "🌙",
    desc: "Hide XP, coins, bosses, and analytics. Just notes and quests.",
    features: ["No XP/coin display", "No boss fights", "No minigames", "Clean, distraction-free"],
  },
];

export default function GamificationSettings() {
  const current = () => user()?.gamificationStyle ?? "balanced";
  const [saving, setSaving] = createSignal(false);

  const handleSelect = async (styleId: string) => {
    if (saving()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/users/gamification-style", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamificationStyle: styleId }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`${t("Gamification style updated")}: ${STYLES.find((s) => s.id === styleId)?.name}`, "success");
        // Reload to apply layout changes (sidebar/hide elements)
        setTimeout(() => window.location.reload(), 1000);
      } else {
        addToast(json.error?.message || t("Failed to update"), "error");
      }
    } catch {
      addToast(t("Network error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <A href="/profile" class="text-sm text-ink-secondary hover:text-ink-primary transition-colors">
          ← {t("Back to profile")}
        </A>
        <h1 class="text-2xl font-display font-bold text-ink-primary mt-2">⚔️ Gamification Style</h1>
        <p class="text-sm text-ink-secondary mt-1">
          Choose how the tavern treats you. Switch anytime — your notes and progress are always safe.
        </p>
      </div>

      <div class="space-y-3">
        <For each={STYLES}>
          {(style) => {
            const isSelected = () => current() === style.id;
            return (
              <button
                type="button"
                onClick={() => handleSelect(style.id)}
                disabled={saving()}
                class={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  isSelected()
                    ? "border-accent bg-accent/5 shadow-md"
                    : "border-surface-border bg-surface-elevated hover:border-accent/30"
                } ${saving() ? "opacity-70 cursor-wait" : "cursor-pointer"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`}
                aria-pressed={isSelected()}
              >
                <div class="flex items-start gap-4">
                  <span class="text-3xl shrink-0" aria-hidden="true">{style.icon}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="font-semibold text-ink-primary">{style.name}</h3>
                      <Show when={isSelected()}>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                          Current
                        </span>
                      </Show>
                    </div>
                    <p class="text-sm text-ink-secondary mt-1">{style.desc}</p>
                    <div class="flex flex-wrap gap-1.5 mt-3">
                      <For each={style.features}>
                        {(feat) => (
                          <span class="text-xs px-2 py-0.5 rounded bg-surface border border-surface-border text-ink-tertiary">
                            {feat}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </button>
            );
          }}
        </For>
      </div>

      <p class="text-xs text-ink-tertiary text-center">
        {t("You can change this anytime in Settings")}
      </p>
    </div>
  );
}

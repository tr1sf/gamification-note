import { createSignal, For, Show } from "solid-js";
import { authFetch } from "~/stores/auth";
import { gamification, setCoins } from "~/stores/user";
import { addToast } from "~/stores/ui";
import { applyThemeVariables } from "~/lib/themes/defaults";

interface ThemeItem {
  id: string;
  name: string;
  description: string | null;
  coinCost: number;
  rarity: string;
  isDefault: boolean;
  cssVariables: Record<string, string>;
}

const RARITY_COLORS: Record<string, string> = {
  common: "text-ink-secondary border-ink-secondary/30 bg-ink-secondary/5",
  rare: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  epic: "text-purple-400 border-purple-400/30 bg-purple-400/5",
  legendary: "text-coin border-coin/30 bg-coin/5",
};

export default function ThemePicker() {
  const [themes, setThemes] = createSignal<ThemeItem[]>([]);
  const [ownedThemes, setOwnedThemes] = createSignal<Set<string>>(new Set());
  const [equippedId, setEquippedId] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [actionId, setActionId] = createSignal<string | null>(null);

  const load = async () => {
    try {
      const [themesRes, userThemesRes] = await Promise.all([
        authFetch("/api/themes"),
        authFetch("/api/users/theme"),
      ]);
      const themesJson = await themesRes.json();
      const userThemesJson = await userThemesRes.json();
      if (themesJson.success) setThemes(themesJson.data);

      if (userThemesJson.success) {
        const userThemes = userThemesJson.data as Array<{ themeId: string; isEquipped: boolean }>;
        setOwnedThemes(new Set<string>(userThemes.map((ut) => ut.themeId)));
        const equipped = userThemes.find((ut) => ut.isEquipped);
        if (equipped) {
          setEquippedId(equipped.themeId);
          localStorage.setItem("equippedThemeId", equipped.themeId);
        }
      }
    } catch {}
  };

  // Load on mount
  if (typeof document !== "undefined") {
    load();
  }

  const isOwned = (id: string) => ownedThemes().has(id);

  const handleBuy = async (themeId: string, cost: number) => {
    setActionId(themeId);
    try {
      const res = await authFetch("/api/users/theme", {
        method: "PUT",
        body: JSON.stringify({ themeId }),
      });
      const json = await res.json();
      if (json.success) {
        setCoins(json.data.coins);
        setOwnedThemes((prev) => new Set([...prev, themeId]));
        addToast("Theme purchased!", "success");
      } else {
        addToast(json.error?.message || "Failed to buy theme", "error");
      }
    } catch {
      addToast("Failed to purchase", "error");
    } finally {
      setActionId(null);
    }
  };

  const handleEquip = async (themeId: string) => {
    setActionId(themeId);
    try {
      const res = await authFetch("/api/users/theme", {
        method: "POST",
        body: JSON.stringify({ themeId }),
      });
      const json = await res.json();
      if (json.success) {
        setEquippedId(themeId);
        if (json.data.theme?.cssVariables) {
          applyThemeVariables(json.data.theme.cssVariables);
          localStorage.setItem("equippedThemeId", themeId);
        }
        addToast(`Equipped ${json.data.theme?.name || "theme"}!`, "success");
      } else {
        addToast(json.error?.message || "Failed to equip", "error");
      }
    } catch {
      addToast("Failed to equip theme", "error");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-display font-bold text-ink-primary">Themes</h3>
        <span class="text-sm text-ink-secondary">
          Coins: <span class="text-coin font-bold">{gamification().coins.toLocaleString()}</span>
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <For each={themes()}>
          {(theme) => (
            <div
              class={`p-4 rounded-xl border transition-all ${
                equippedId() === theme.id
                  ? "border-accent bg-accent/5"
                  : "border-surface-border bg-surface-elevated hover:border-accent/30"
              }`}
            >
              <div class="flex items-start justify-between mb-2">
                <div>
                  <h4 class="font-semibold text-ink-primary">{theme.name}</h4>
                  <p class="text-xs text-ink-secondary mt-0.5">{theme.description}</p>
                </div>
                <span
                  class={`text-xs px-1.5 py-0.5 rounded border font-medium ${RARITY_COLORS[theme.rarity] || ""}`}
                >
                  {theme.rarity}
                </span>
              </div>

              {/* Color preview */}
              <div class="flex items-center gap-1 mb-3">
                {["--color-bg", "--color-bg-elevated", "--color-accent", "--color-text-primary"].map((key) => {
                  const val = theme.cssVariables?.[key];
                  if (!val) return null;
                  const rgb = val.split(" ").slice(0, 3).join(", ");
                  return (
                    <div
                      class="w-5 h-5 rounded-full border border-surface-border"
                      style={{ background: `rgb(${rgb})` }}
                      title={key}
                    />
                  );
                })}
              </div>

              <div class="flex items-center gap-2">
                <Show
                  when={isOwned(theme.id)}
                  fallback={
                    <button
                      onClick={() => handleBuy(theme.id, theme.coinCost)}
                      disabled={actionId() === theme.id || (theme.coinCost > 0 && gamification().coins < theme.coinCost)}
                      class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        theme.coinCost > 0 && gamification().coins < theme.coinCost
                          ? "bg-surface-border text-ink-secondary/40 cursor-not-allowed"
                          : "bg-accent/10 text-accent hover:bg-accent/20"
                      }`}
                    >
                      {theme.coinCost > 0 ? `${theme.coinCost} coins` : "Free"}
                    </button>
                  }
                >
                  <Show
                    when={equippedId() !== theme.id}
                    fallback={<span class="text-xs text-success font-medium">Equipped</span>}
                  >
                    <button
                      onClick={() => handleEquip(theme.id)}
                      disabled={actionId() === theme.id}
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                    >
                      Equip
                    </button>
                  </Show>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

import { Show, For, createSignal, createMemo, onCleanup } from "solid-js";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { t } from "~/lib/i18n";

export interface InventoryItem {
  id: string;
  inventoryId: string;
  name: string;
  description: string;
  icon: string;
  itemType: string;
  itemCategory?: { usageType?: string };
  rarity: string;
  quantity: number;
  equipped: boolean;
  owned: boolean;
  expiresAt: string | null;
}

interface InventoryPanelProps {
  items: InventoryItem[];
  onRefresh?: () => void;
}

const rarityColors: Record<string, string> = {
  common: "bg-ink-secondary/10 text-ink-secondary border-ink-secondary/20",
  uncommon: "bg-green-500/10 text-green-500 border-green-500/20",
  rare: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  epic: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  legendary: "bg-coin/10 text-coin border-coin/20",
};

const CONSUMABLE_TYPE = "consumable";

function TimeRemaining(props: { expiresAt: string }) {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(timer));

  const remaining = createMemo(() => {
    const diff = new Date(props.expiresAt).getTime() - now();
    if (diff <= 0) return t("Expired");
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  });

  return (
    <span class="text-[10px] text-ink-secondary mt-0.5 block">{remaining()}</span>
  );
}

export default function InventoryPanel(props: InventoryPanelProps) {
  const [actionId, setActionId] = createSignal<string | null>(null);

  const handleEquip = async (inventoryId: string) => {
    setActionId(inventoryId);
    try {
      const res = await authFetch(`/api/inventory/${inventoryId}/equip`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addToast(t("Item equipped!"), "success");
        props.onRefresh?.();
      } else {
        addToast(json.error?.message || t("Failed to equip"), "error");
      }
    } catch {
      addToast(t("Failed to equip item"), "error");
    } finally {
      setActionId(null);
    }
  };

  const handleOpen = async (inventoryId: string) => {
    setActionId(inventoryId);
    try {
      const res = await authFetch(`/api/inventory/${inventoryId}/open`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addToast(`${t("Open")}! ${t("You got")} ${json.data.name}`, "success");
        props.onRefresh?.();
      } else {
        addToast(json.error?.message || t("Failed to open"), "error");
      }
    } catch {
      addToast(t("Failed to open loot box"), "error");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div class="p-6 rounded-xl border border-surface-border bg-surface-elevated">
      <h2 class="text-lg font-display font-bold text-ink-primary mb-4">{t("Inventory")}</h2>
      <Show
        when={props.items.length > 0}
        fallback={
          <p class="text-sm text-ink-secondary py-4 text-center">{t("No items yet")}</p>
        }
      >
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <For each={props.items}>
            {(item) => (
              <div
                class={`p-3 rounded-lg border text-center transition-all ${
                  item.equipped
                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                    : "border-surface-border bg-surface hover:shadow-sm"
                }`}
              >
                <div class="relative inline-block">
                  <Show when={item.icon.startsWith("/")} fallback={<span class="text-2xl" aria-hidden="true">{item.icon}</span>}>
                    <img src={item.icon} alt={item.name} class="w-8 h-8 object-contain" />
                  </Show>
                  <Show when={item.itemType === CONSUMABLE_TYPE && item.quantity > 1}>
                    <span class="absolute -top-1.5 -right-2 min-w-[1.25rem] h-5 flex items-center justify-center px-1 text-[10px] font-bold rounded-full bg-error text-white border border-surface">
                      {item.quantity}
                    </span>
                  </Show>
                </div>
                <p class="text-xs font-semibold text-ink-primary mt-1 truncate">{item.name}</p>
                <span
                  class={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-medium border ${
                    rarityColors[item.rarity] || rarityColors.common
                  }`}
                >
                  {t(item.rarity)}
                </span>

                <Show when={item.expiresAt}>
                  <TimeRemaining expiresAt={item.expiresAt!} />
                </Show>

                <div class="mt-2">
                  <Show when={item.itemType === CONSUMABLE_TYPE}>
                    <Show when={item.itemCategory?.usageType === "loot_box"} fallback={
                      <span class="text-xs text-success font-medium">{t("Active")}</span>
                    }>
                      <button
                        onClick={() => handleOpen(item.inventoryId)}
                        disabled={actionId() === item.inventoryId}
                        class="px-2 py-1 rounded text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                      >
                        {actionId() === item.inventoryId ? "..." : t("Open")}
                      </button>
                    </Show>
                  </Show>

                  <Show when={item.itemType !== CONSUMABLE_TYPE && !item.equipped}>
                    <button
                      onClick={() => handleEquip(item.inventoryId)}
                      disabled={actionId() === item.inventoryId}
                      class="px-2 py-1 rounded text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                      {actionId() === item.inventoryId ? "..." : t("Equip")}
                    </button>
                  </Show>

                  <Show when={item.itemType !== CONSUMABLE_TYPE && item.equipped}>
                    <p class="text-[10px] text-accent font-semibold mt-1">{t("Equipped")}</p>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

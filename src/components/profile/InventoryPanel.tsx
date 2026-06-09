import { Show, For } from "solid-js";

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  itemType: string;
  rarity: string;
  equipped: boolean;
  owned: boolean;
}

interface InventoryPanelProps {
  items: InventoryItem[];
}

const rarityColors: Record<string, string> = {
  common: "bg-ink-secondary/10 text-ink-secondary border-ink-secondary/20",
  uncommon: "bg-green-500/10 text-green-500 border-green-500/20",
  rare: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  epic: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  legendary: "bg-coin/10 text-coin border-coin/20",
};

export default function InventoryPanel(props: InventoryPanelProps) {
  return (
    <div class="p-6 rounded-xl border border-surface-border bg-surface-elevated">
      <h2 class="text-lg font-display font-bold text-ink-primary mb-4">Inventory</h2>
      <Show
        when={props.items.length > 0}
        fallback={
          <p class="text-sm text-ink-secondary py-4 text-center">No items yet</p>
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
                <span class="text-2xl" aria-hidden="true">{item.icon}</span>
                <p class="text-xs font-semibold text-ink-primary mt-1 truncate">{item.name}</p>
                <span
                  class={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-medium border ${
                    rarityColors[item.rarity] || rarityColors.common
                  }`}
                >
                  {item.rarity}
                </span>
                <Show when={item.equipped}>
                  <p class="text-[10px] text-accent font-semibold mt-1">Equipped</p>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

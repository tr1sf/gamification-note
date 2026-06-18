import { Show, For } from "solid-js";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  coinCost: number;
  owned: boolean;
  itemType: string;
  type?: string;
}

interface ShopGridProps {
  items: ShopItem[];
  userCoins: number;
  onBuy: (itemId: string) => void;
  buyingId?: string | null;
}

const rarityColors: Record<string, string> = {
  common: "bg-ink-secondary/10 text-ink-secondary border-ink-secondary/20",
  uncommon: "bg-green-500/10 text-green-500 border-green-500/20",
  rare: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  epic: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  legendary: "bg-coin/10 text-coin border-coin/20",
};

export default function ShopGrid(props: ShopGridProps) {
  return (
    <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <For each={props.items}>
        {(item) => {
          const canAfford = () => props.userCoins >= item.coinCost;
          const isBuying = () => props.buyingId === item.id;

          return (
            <Show when={!item.owned}>
              <div class="p-4 rounded-lg border border-surface-border bg-surface-elevated flex flex-col">
                <div class="flex items-start gap-3">
                  <span class="text-2xl shrink-0" aria-hidden="true">{item.icon}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h3 class="font-semibold text-ink-primary text-sm truncate">{item.name}</h3>
                      <span
                        class={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border shrink-0 ${
                          rarityColors[item.rarity] || rarityColors.common
                        }`}
                      >
                        {item.rarity}
                      </span>
                    </div>
                    <p class="text-xs text-ink-secondary mt-1 line-clamp-2">{item.description}</p>
                  </div>
                </div>

                <div class="mt-auto pt-3 flex items-center justify-between">
                  <span class="flex items-center gap-1 text-sm font-bold text-coin">
                    <span aria-hidden="true">🪙</span>
                    {item.coinCost.toLocaleString()}
                  </span>
                  <button
                    onClick={() => props.onBuy(item.id)}
                    disabled={!canAfford() || isBuying()}
                    class="px-3 py-1 text-xs font-semibold rounded-md bg-accent text-surface-overlay hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={!canAfford() ? "Not enough coins" : "Buy item"}
                  >
                    {isBuying() ? "Buying..." : !canAfford() ? "Not enough coins" : "Buy"}
                  </button>
                </div>
              </div>
            </Show>
          );
        }}
      </For>
    </div>
  );
}

import { createSignal, createResource, Show, For, onMount } from "solid-js";
import { authFetch } from "~/stores/auth";
import { gamification, setCoins } from "~/stores/user";
import { addToast } from "~/stores/ui";
import ShopGrid, { type ShopItem } from "~/components/shop/ShopGrid";
import ThemePicker from "~/components/shop/ThemePicker";

async function fetchShop(): Promise<ShopItem[]> {
  try {
    const res = await authFetch("/api/shop");
    const json = await res.json();
    if (json.success) return json.data || [];
    return [];
  } catch {
    return [];
  }
}

async function fetchRecommended(): Promise<ShopItem[]> {
  try {
    const res = await authFetch("/api/shop/recommended");
    const json = await res.json();
    if (json.success) return json.data || [];
    return [];
  } catch {
    return [];
  }
}

export default function ShopPage() {
  const [shopItems, { refetch }] = createResource(fetchShop);
  const [recommended, { refetch: refetchRec }] = createResource(fetchRecommended);
  const [buyingId, setBuyingId] = createSignal<string | null>(null);
  const [shopTab, setShopTab] = createSignal("cosmetics");

  const g = () => gamification();

  const visibleItems = () => {
    const items = shopItems() || [];
    switch (shopTab()) {
      case "consumables": return items.filter((i) => (i as any).itemType === "consumable");
      case "themes": return [];
      default: return items.filter((i) => (i as any).itemType !== "consumable" && (i as any).itemType !== "theme");
    }
  };

  const handleBuy = async (itemId: string) => {
    setBuyingId(itemId);
    try {
      const res = await authFetch(`/api/shop/${itemId}/purchase`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addToast("Item purchased!", "success");
        if (typeof json.data?.coins === "number") {
          setCoins(json.data.coins);
        }
        refetch();
        refetchRec();
      } else {
        addToast(json.error?.message || "Purchase failed", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setBuyingId(null);
    }
  };

  const tabs = [
    { id: "cosmetics" as const, label: "Cosmetics", icon: "✨" },
    { id: "consumables" as const, label: "Consumables", icon: "⚗️" },
    { id: "themes" as const, label: "Themes", icon: "🎨" },
  ];

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Tavern Shop</h1>
          <p class="text-sm text-ink-secondary mt-1">Spend your coins on cosmetics</p>
        </div>
        <div class="flex items-center gap-1 text-coin font-bold text-lg">
          <span aria-hidden="true">🪙</span>
          <span>{g().coins.toLocaleString()}</span>
        </div>
      </div>

      {/* Recommended For You */}
      <Show when={recommended() && (recommended()!.length > 0)}>
        <div class="space-y-3">
          <h2 class="text-sm font-semibold text-ink-secondary uppercase tracking-wide">Recommended For You</h2>
          <div class="flex gap-3 overflow-x-auto pb-2">
            <For each={recommended()}>
              {(item) => {
                const canAfford = () => g().coins >= item.coinCost;
                const isBuying = () => buyingId() === item.id;
                return (
                  <div class="flex-shrink-0 w-48 p-4 rounded-lg border border-accent/20 bg-accent/5">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-xl" aria-hidden="true">{item.icon}</span>
                      <span class="text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">For You</span>
                    </div>
                    <h3 class="font-semibold text-ink-primary text-sm truncate">{item.name}</h3>
                    <p class="text-xs text-ink-secondary mt-1 line-clamp-2">{item.description}</p>
                    <div class="mt-3 flex items-center justify-between">
                      <span class="flex items-center gap-1 text-sm font-bold text-coin">
                        <span aria-hidden="true">🪙</span>
                        {item.coinCost.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleBuy(item.id)}
                        disabled={!canAfford() || isBuying()}
                        class="px-3 py-1 text-xs font-semibold rounded-md bg-accent text-surface-overlay hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isBuying() ? "Buying..." : !canAfford() ? "No coins" : "Buy"}
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Tab bar */}
      <div class="flex gap-1 border-b border-surface-border">
        {tabs.map((tab) => (
          <button
            onClick={() => setShopTab(tab.id)}
            class={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              shopTab() === tab.id
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
        when={!shopItems.loading}
        fallback={
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div class="h-44 bg-surface-border rounded-lg animate-pulse" />
            ))}
          </div>
        }
      >
        <Show when={shopTab() === "themes"}>
          <ThemePicker />
        </Show>

        <Show when={shopTab() !== "themes"}>
          <Show
            when={!shopItems.error && visibleItems().length > 0}
            fallback={
              <div class="text-center py-12 text-ink-secondary">
                <p class="text-4xl mb-3">🏪</p>
                <p>No items available in this category.</p>
              </div>
            }
          >
            <ShopGrid
              items={visibleItems()}
              userCoins={g().coins}
              onBuy={handleBuy}
              buyingId={buyingId()}
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
}

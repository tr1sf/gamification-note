import { createSignal, createResource, Show, onMount } from "solid-js";
import { authFetch } from "~/stores/auth";
import { gamification, setCoins } from "~/stores/user";
import { addToast } from "~/stores/ui";
import ShopGrid, { type ShopItem } from "~/components/shop/ShopGrid";

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

export default function ShopPage() {
  const [shopItems, { refetch }] = createResource(fetchShop);
  const [buyingId, setBuyingId] = createSignal<string | null>(null);

  const g = () => gamification();

  const handleBuy = async (itemId: string) => {
    setBuyingId(itemId);
    try {
      const res = await authFetch(`/api/shop/${itemId}/purchase`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addToast("Item purchased!", "success");
        // Purchase endpoint returns the new absolute coin balance.
        if (typeof json.data?.coins === "number") {
          setCoins(json.data.coins);
        }
        refetch();
      } else {
        addToast(json.error?.message || "Purchase failed", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setBuyingId(null);
    }
  };

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
        <Show
          when={!shopItems.error && (shopItems()?.length ?? 0) > 0}
          fallback={
            <div class="text-center py-12 text-ink-secondary">
              <p class="text-4xl mb-3">🏪</p>
              <p>No items available in the shop right now.</p>
            </div>
          }
        >
          <ShopGrid
            items={shopItems()!}
            userCoins={g().coins}
            onBuy={handleBuy}
            buyingId={buyingId()}
          />
        </Show>
      </Show>
    </div>
  );
}

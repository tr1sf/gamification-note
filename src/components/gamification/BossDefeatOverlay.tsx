import { createSignal, Show, onCleanup } from "solid-js";

/**
 * BossDefeatOverlay — full-screen flash + victory text when a boss is defeated.
 * Listens for a global `boss-defeated` custom event.
 */

interface BossDefeatData {
  bossName: string;
  bossEmoji: string;
  rewardXp: number;
  rewardCoins: number;
}

const [defeatData, setDefeatData] = createSignal<BossDefeatData | null>(null);
const [visible, setVisible] = createSignal(false);

export function triggerBossDefeat(data: BossDefeatData) {
  setDefeatData(data);
  setVisible(true);
  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    setVisible(false);
    setTimeout(() => setDefeatData(null), 300);
  }, 3000);
}

export default function BossDefeatOverlay() {
  return (
    <Show when={visible() && defeatData()}>
      {(data) => (
        <div
          class="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none"
          style={{ animation: "fade-in 0.3s ease-out" }}
          role="alert"
          aria-live="assertive"
        >
          {/* Red flash background */}
          <div
            class="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at center, rgba(176,42,32,0.3) 0%, rgba(0,0,0,0.5) 70%)",
              animation: "boss-flash 0.5s ease-out",
            }}
            aria-hidden="true"
          />

          {/* Victory content */}
          <div
            class="relative text-center space-y-4"
            style={{ animation: "boss-victory-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            <div class="text-7xl" style={{ animation: "nelar-bounce 0.6s ease-in-out infinite" }} aria-hidden="true">
              {data().bossEmoji || "👻"}
            </div>
            <div>
              <p class="text-xs font-bold tracking-widest uppercase text-error mb-1">BOSS DEFEATED</p>
              <h2 class="text-3xl font-display font-extrabold text-ink-primary">
                {data().bossName}
              </h2>
            </div>
            <div class="flex items-center justify-center gap-6">
              <Show when={data().rewardXp > 0}>
                <span class="text-xl font-bold text-xp">+{data().rewardXp} XP</span>
              </Show>
              <Show when={data().rewardCoins > 0}>
                <span class="text-xl font-bold text-coin">+{data().rewardCoins} 🪙</span>
              </Show>
            </div>
            <p class="text-sm text-ink-secondary">Click "Claim Loot" to collect your rewards!</p>
          </div>

          <style>{`
            @keyframes boss-flash {
              0% { opacity: 0; }
              30% { opacity: 1; }
              100% { opacity: 0.6; }
            }
            @keyframes boss-victory-pop {
              0% { transform: scale(0.5); opacity: 0; }
              60% { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </Show>
  );
}

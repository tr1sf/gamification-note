import { createSignal, For, Show, onCleanup } from "solid-js";
import { authFetch } from "~/stores/auth";
import { addToast, showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";

const CATEGORIES = [
  { id: "kitchen", name: "Tavern Kitchen", emoji: "🍎", desc: "Food & Drinks (Easy)" },
  { id: "forest", name: "Forest Trail", emoji: "🌿", desc: "Animals & Nature (Medium)" },
  { id: "workshop", name: "Workshop", emoji: "⚙️", desc: "Tools & Objects (Medium)" },
  { id: "scholar", name: "Scholar's Study", emoji: "📚", desc: "Academic (Hard)" },
];

interface Card { id: string; type: string; display: string; pairId: number; flipped?: boolean; matched?: boolean; }

export default function PotionMatch() {
  const [category, setCategory] = createSignal("kitchen");
  const [cards, setCards] = createSignal<Card[]>([]);
  const [pairCount, setPairCount] = createSignal(4);
  const [flipped, setFlipped] = createSignal<Card[]>([]);
  const [matched, setMatched] = createSignal(0);
  const [totalFlips, setTotalFlips] = createSignal(0);
  const [gameState, setGameState] = createSignal<"menu" | "playing" | "done">("menu");
  const [result, setResult] = createSignal<any>(null);
  const [timeLeft, setTimeLeft] = createSignal(45);
  let timer: ReturnType<typeof setInterval> | null = null;

  onCleanup(() => clearInterval(timer as ReturnType<typeof setInterval>));

  const startGame = async () => {
    const res = await authFetch("/api/minigames/potion/play", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category() }),
    });
    const json = await res.json();
    if (!json.success) { addToast(json.error?.message || "Cannot play", "error"); return; }

    setCards(json.data.cards.map((c: Card) => ({ ...c, flipped: false, matched: false })));
    setPairCount(json.data.pairCount);
    setMatched(0); setTotalFlips(0); setFlipped([]); setResult(null);
    setGameState("playing");
    setTimeLeft(category() === "kitchen" ? 45 : 60);
    clearInterval(timer as ReturnType<typeof setInterval>);
    timer = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
  };

  const flipCard = (card: Card) => {
    if (card.flipped || card.matched || flipped().length >= 2 || gameState() !== "playing") return;
    const newCards = cards().map(c => c.id === card.id ? { ...c, flipped: true } : c);
    setCards(newCards);
    setFlipped([...flipped(), card]);
    setTotalFlips(t => t + 1);

    if (flipped().length === 1) {
      const first = flipped()[0];
      if (first.pairId === card.pairId && first.type !== card.type) {
        // Match!
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.pairId === card.pairId ? { ...c, matched: true } : c)));
          setFlipped([]);
          setMatched(m => {
            if (m + 1 >= pairCount()) { setTimeout(endGame, 500); }
            return m + 1;
          });
        }, 400);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.flipped && !c.matched ? { ...c, flipped: false } : c)));
          setFlipped([]);
        }, 800);
      }
    }
  };

  const endGame = async () => {
    clearInterval(timer as ReturnType<typeof setInterval>);
    setGameState("done");
    const res = await authFetch("/api/minigames/potion/complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category(), pairCount: pairCount(), correctPairs: matched(), totalFlips: totalFlips(), timeTaken: 0 }),
    });
    const json = await res.json();
    if (json.success) {
      setResult(json.data);
      if (json.data.xp > 0 || json.data.coins > 0) {
        applyReward({ xpGained: json.data.xp, coinsGained: json.data.coins, leveledUp: false });
        showReward({ message: json.data.message, xp: json.data.xp, coins: json.data.coins });
      }
    }
  };

  return (
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <h1 class="text-2xl font-display font-bold text-ink-primary">🧪 Potion Match</h1>
      <Show when={gameState() === "menu"} fallback={
        <Show when={gameState() === "playing"} fallback={
          /* Done screen */
          <div class="bg-surface-elevated rounded-xl p-8 border border-surface-border text-center space-y-4">
            <p class="text-5xl">{result()?.perfect ? "🧙‍♂️" : "🧪"}</p>
            <p class="text-xl font-bold text-ink-primary">{result()?.message || "Game Over!"}</p>
            <p class="text-sm text-ink-secondary">Accuracy: {result()?.accuracy || 0}%</p>
            <Show when={(result()?.xp > 0 || result()?.coins > 0)}>
              <div class="flex justify-center gap-4 text-sm"><span class="text-xp">+{result()?.xp} XP</span><span class="text-coin">+{result()?.coins} coins</span></div>
            </Show>
            <button onClick={() => setGameState("menu")} class="px-6 py-2 bg-accent text-white rounded-lg font-medium">Play Again</button>
          </div>
        }>
          {/* Playing screen */}
          <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-medium text-ink-primary">Pairs: {matched()}/{pairCount()}</p>
              <p class={`text-sm font-mono font-bold ${timeLeft() <= 10 ? "text-error animate-pulse" : "text-ink-secondary"}`}>⏱️ {timeLeft()}s</p>
              <p class="text-sm text-ink-secondary">Flips: {totalFlips()}</p>
            </div>
            <div class={`grid gap-2 ${pairCount() === 4 ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-6"}`}>
              <For each={cards()}>{(card) => (
                <button onClick={() => flipCard(card)}
                  class={`aspect-square rounded-lg flex items-center justify-center text-2xl font-bold transition-all duration-300 border-2 ${
                    card.matched ? "bg-success/20 border-success/50 scale-95 opacity-60" :
                    card.flipped ? "bg-accent/10 border-accent" :
                    "bg-surface border-surface-border hover:border-accent/30"
                  }`}>
                  {card.flipped || card.matched ? (card.type === "emoji" ? card.display : <span class="text-sm">{card.display}</span>) : "📜"}
                </button>
              )}</For>
            </div>
          </div>
        </Show>
      }>
        {/* Menu screen */}
        <p class="text-sm text-ink-secondary mb-4">Match emojis with their English words. Fewer flips = higher score!</p>
        <div class="grid grid-cols-2 gap-3 mb-6">
          <For each={CATEGORIES}>{(cat) => (
            <button onClick={() => setCategory(cat.id)}
              class={`p-4 rounded-xl border-2 text-left transition-all ${category() === cat.id ? "border-accent bg-accent/5" : "border-surface-border hover:border-accent/30"}`}>
              <p class="text-2xl">{cat.emoji}</p><p class="font-semibold text-sm text-ink-primary mt-1">{cat.name}</p><p class="text-xs text-ink-secondary">{cat.desc}</p>
            </button>
          )}</For>
        </div>
        <button onClick={startGame} class="w-full py-3 bg-accent text-white rounded-xl font-semibold text-lg">Play (1 Alchemy Ticket) 🎫</button>
        <p class="text-xs text-ink-secondary/60 text-center mt-2">Buy Alchemy Tickets from the Shop (15 coins each)</p>
      </Show>
    </div>
  );
}

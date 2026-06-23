import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { authFetch } from "~/stores/auth";
import { gamification, applyReward } from "~/stores/user";
import { addToast, showReward } from "~/stores/ui";
import { THEMES, getThemesForLevel, getDifficultyForLevel, type Theme, type DifficultyParams } from "~/lib/minigames/vocab";

interface Card { id: string; type: string; display: string; pairId: number; flipped?: boolean; matched?: boolean; }

export default function PotionMatch() {
  const [theme, setTheme] = createSignal("kitchen");
  const [cards, setCards] = createSignal<Card[]>([]);
  const [pairCount, setPairCount] = createSignal(4);
  const [flipped, setFlipped] = createSignal<Card[]>([]);
  const [matched, setMatched] = createSignal(0);
  const [totalFlips, setTotalFlips] = createSignal(0);
  const [gameState, setGameState] = createSignal<"menu" | "playing" | "done">("menu");
  const [result, setResult] = createSignal<any>(null);
  const [timeLeft, setTimeLeft] = createSignal(60);
  const [ticketCount, setTicketCount] = createSignal(0);
  const [diff, setDiff] = createSignal<DifficultyParams>(getDifficultyForLevel(1));
  let timer: ReturnType<typeof setInterval> | null = null;

  const level = () => gamification().level;
  const availableThemes = () => getThemesForLevel(level());
  const currentDiff = () => getDifficultyForLevel(level());

  const tierColor = () => {
    switch (currentDiff().tier) {
      case "Master": return "text-yellow-400";
      case "Adept": return "text-violet-400";
      case "Journeyman": return "text-sky-400";
      default: return "text-ink-muted";
    }
  };

  const loadTickets = async () => {
    const res = await authFetch("/api/minigames/potion/tickets");
    const json = await res.json();
    if (json.success) setTicketCount(json.data.count ?? 0);
  };

  onMount(() => { loadTickets(); setDiff(currentDiff()); });

  onCleanup(() => clearInterval(timer as ReturnType<typeof setInterval>));

  const startGame = async () => {
    setDiff(currentDiff());
    const res = await authFetch("/api/minigames/potion/play", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: theme(), level: level() }),
    });
    const json = await res.json();
    if (!json.success) { addToast(json.error?.message || "Cannot play", "error"); return; }

    setCards(json.data.cards.map((c: Card) => ({ ...c, flipped: false, matched: false })));
    setPairCount(json.data.pairCount);
    setMatched(0); setTotalFlips(0); setFlipped([]); setResult(null);
    setGameState("playing");
    setTimeLeft(json.data.timeLimit || 60);
    clearInterval(timer as ReturnType<typeof setInterval>);
    timer = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0; } return t - 1; });
    }, 1000);
  };

  const flipCard = (card: Card) => {
    if (card.flipped || card.matched || flipped().length >= 2 || gameState() !== "playing") return;
    const currentFlipped = flipped();
    const previous = currentFlipped[0];

    setCards(cards().map(c => c.id === card.id ? { ...c, flipped: true } : c));
    setFlipped([...currentFlipped, card]);
    setTotalFlips(t => t + 1);

    if (previous) {
      if (previous.pairId === card.pairId && previous.type !== card.type) {
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.pairId === card.pairId ? { ...c, matched: true } : c)));
          setFlipped([]);
          setMatched(m => {
            if (m + 1 >= pairCount()) { setTimeout(endGame, 500); }
            return m + 1;
          });
        }, 400);
      } else {
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
      body: JSON.stringify({ category: theme(), pairCount: pairCount(), correctPairs: matched(), totalFlips: totalFlips(), timeTaken: 0, level: level() }),
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

  const lockedThemes = () => THEMES.filter(t => t.unlockLevel > level());

  const gridCols = () => {
    const p = pairCount();
    if (p <= 4) return "grid-cols-4";
    if (p <= 6) return "grid-cols-4 sm:grid-cols-6";
    if (p <= 8) return "grid-cols-4 sm:grid-cols-8";
    return "grid-cols-4 sm:grid-cols-5";
  };

  return (
    <div class="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 class="text-xl sm:text-2xl font-display font-bold text-ink-primary">🧪 Potion Match</h1>
      <Show when={gameState() === "menu"} fallback={
        <Show when={gameState() === "playing"} fallback={
          /* Done screen */
          <div class="bg-surface-elevated rounded-xl p-8 border border-surface-border text-center space-y-4">
            <p class="text-5xl">{result()?.perfect ? "🧙‍♂️" : "🧪"}</p>
            <p class="text-xl font-bold text-ink-primary">{result()?.message || "Game Over!"}</p>
            <p class="text-sm text-ink-secondary">
              Accuracy: {result()?.accuracy || 0}% · {result()?.difficulty}
            </p>
            <Show when={(result()?.xp > 0 || result()?.coins > 0)}>
              <div class="flex justify-center gap-4 text-sm font-mono">
                <span class="text-xp">+{result()?.xp} XP</span>
                <span class="text-coin">+{result()?.coins} coins</span>
              </div>
            </Show>
            <button onClick={() => { setGameState("menu"); loadTickets(); }} class="px-6 py-2 bg-accent text-white rounded-lg font-medium">Play Again</button>
          </div>
        }>
          {/* Playing screen */}
          <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-medium text-ink-primary">Pairs: {matched()}/{pairCount()}</p>
              <span class={`text-[10px] px-2 py-0.5 rounded-full border ${tierColor()}`}>
                {currentDiff().tier} ({currentDiff().pairCount}p · {currentDiff().timeLimit}s · x{currentDiff().rewardMultiplier})
              </span>
              <p class={`text-sm font-mono font-bold ${timeLeft() <= 10 ? "text-error animate-pulse" : "text-ink-secondary"}`}>⏱️ {timeLeft()}s</p>
              <p class="text-sm text-ink-secondary">Flips: {totalFlips()}</p>
            </div>
            <div class={`grid gap-2 ${gridCols()}`}>
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
        <p class="text-sm text-ink-secondary">Match emojis with their English words. Fewer flips = higher score!</p>

        {/* Difficulty tier */}
        <div class="flex items-center gap-3 bg-surface-elevated rounded-lg border border-surface-border px-4 py-2.5">
          <span class="text-sm text-ink-secondary">Your tier:</span>
          <span class={`text-sm font-semibold ${tierColor()}`}>{currentDiff().tier}</span>
          <span class="text-xs text-ink-muted">
            {currentDiff().pairCount} pairs · {currentDiff().timeLimit}s · x{currentDiff().rewardMultiplier} rewards
          </span>
          <span class="text-xs text-ink-muted ml-auto">
            Next: Lv {level() < 5 ? 5 : level() < 10 ? 10 : level() < 15 ? 15 : "MAX"}
          </span>
        </div>

        {/* Theme grid */}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <For each={availableThemes()}>{(t: Theme) => (
            <button onClick={() => setTheme(t.id)}
              class={`p-4 rounded-xl border-2 text-left transition-all ${
                theme() === t.id ? "border-accent bg-accent/5 ring-1 ring-accent/30" : "border-surface-border hover:border-accent/30"
              }`}>
              <p class="text-2xl">{t.emoji}</p>
              <p class="font-semibold text-sm text-ink-primary mt-1">{t.name}</p>
              <p class="text-xs text-ink-secondary">{t.desc}</p>
            </button>
          )}</For>
          <For each={lockedThemes()}>{(t: Theme) => (
            <div class="p-4 rounded-xl border-2 border-surface-border text-left opacity-40 cursor-not-allowed">
              <p class="text-2xl grayscale">{t.emoji}</p>
              <p class="font-semibold text-sm text-ink-primary mt-1">{t.name}</p>
              <p class="text-xs text-ink-muted">Unlocks at Lv {t.unlockLevel}</p>
            </div>
          )}</For>
        </div>

        {/* ticket info + play button */}
        <div class="flex items-center justify-between bg-surface-elevated rounded-lg border border-surface-border px-4 py-2 mb-4">
          <span class="text-sm text-ink-secondary">Alchemy Tickets</span>
          <span class="text-sm font-bold text-ink-primary">{ticketCount()} 🎫</span>
        </div>
        <button onClick={startGame} disabled={ticketCount() <= 0} class="w-full py-3 bg-accent text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed">
          {ticketCount() > 0 ? "Play (1 Alchemy Ticket) 🎫" : "Out of tickets 🎫"}
        </button>
        <Show when={ticketCount() <= 0}>
          <p class="text-xs text-error/80 text-center mt-2">Buy Alchemy Tickets from the Shop (15 coins each)</p>
        </Show>
      </Show>
    </div>
  );
}

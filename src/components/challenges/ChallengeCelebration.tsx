import { For, Show } from "solid-js";
import { A } from "@solidjs/router";

interface CelebrationProps {
  theme: string;
  title: string;
  rewardXp: number;
  rewardCoins: number;
  onRestart: () => void;
  restarting: boolean;
}

interface Particle {
  emoji: string;
  /** left/top as % within the card */
  x: number;
  y: number;
  delay: number;
  size?: string;
  /** extra CSS vars (e.g. --snap-rot for puzzle) */
  style?: Record<string, string>;
}

interface ThemeEffect {
  centerIcon: string;
  centerClass: string; // animation for the central icon
  auraColor: string;   // CSS color for the radial glow behind the icon
  particles: Particle[];
}

// Per-theme particle choreography. Each theme tells a tiny story on completion.
const EFFECTS: Record<string, ThemeEffect> = {
  growth: {
    centerIcon: "🌱",
    centerClass: "animate-celebration-bounce",
    auraColor: "rgb(126 184 104)",
    particles: [
      { emoji: "🍃", x: 12, y: 70, delay: 0 },
      { emoji: "🌿", x: 30, y: 80, delay: 0.4 },
      { emoji: "🍃", x: 55, y: 75, delay: 0.8 },
      { emoji: "🌸", x: 72, y: 82, delay: 0.3 },
      { emoji: "🍃", x: 86, y: 68, delay: 1.1 },
      { emoji: "🌿", x: 45, y: 85, delay: 1.4 },
    ].map((p) => ({ ...p, style: { animation: `leaf-rise 2.4s ease-out ${p.delay}s infinite` } })),
  },
  journey: {
    centerIcon: "🧭",
    centerClass: "animate-compass-spin",
    auraColor: "rgb(124 178 232)",
    particles: [
      { emoji: "👣", x: 10, y: 78, delay: 0 },
      { emoji: "☁️", x: 28, y: 22, delay: 0.6 },
      { emoji: "👣", x: 40, y: 80, delay: 0.5 },
      { emoji: "⛰️", x: 70, y: 70, delay: 0.2 },
      { emoji: "☁️", x: 80, y: 28, delay: 1.0 },
      { emoji: "🗺️", x: 58, y: 30, delay: 0.9 },
    ].map((p) => ({ ...p, style: { animation: `trail-drift 2s ease-in-out ${p.delay}s infinite` } })),
  },
  puzzle: {
    centerIcon: "🧩",
    centerClass: "animate-piece-snap",
    auraColor: "rgb(198 150 232)",
    particles: [
      { emoji: "🧩", x: 14, y: 22, delay: 0, style: { "--snap-rot": "-120deg" } },
      { emoji: "🧩", x: 80, y: 20, delay: 0.15, style: { "--snap-rot": "120deg" } },
      { emoji: "🧩", x: 18, y: 74, delay: 0.3, style: { "--snap-rot": "90deg" } },
      { emoji: "🧩", x: 78, y: 76, delay: 0.45, style: { "--snap-rot": "-90deg" } },
      { emoji: "✨", x: 48, y: 18, delay: 0.6, style: { "--snap-rot": "0deg" } },
    ].map((p) => ({ ...p, style: { ...p.style, "animation-name": "piece-snap", "animation-duration": "0.9s", "animation-timing-function": "cubic-bezier(0.22, 1.2, 0.36, 1)", "animation-fill-mode": "both", "animation-delay": `${p.delay}s` } })),
  },
  star: {
    centerIcon: "⭐",
    centerClass: "animate-celebration-bounce",
    auraColor: "rgb(240 184 88)",
    particles: [
      { emoji: "🌟", x: 14, y: 60, delay: 0, style: { animation: "shoot-star 1.8s ease-in 0s infinite" } },
      { emoji: "💫", x: 60, y: 55, delay: 0.7, style: { animation: "shoot-star 1.8s ease-in 0.7s infinite" } },
      { emoji: "✨", x: 24, y: 22, delay: 0.2, style: { animation: "twinkle 1.5s ease-in-out 0.2s infinite" } },
      { emoji: "✨", x: 76, y: 26, delay: 0.6, style: { animation: "twinkle 1.5s ease-in-out 0.6s infinite" } },
      { emoji: "⭐", x: 50, y: 16, delay: 1.0, style: { animation: "twinkle 1.5s ease-in-out 1s infinite" } },
      { emoji: "✨", x: 88, y: 64, delay: 0.4, style: { animation: "twinkle 1.5s ease-in-out 0.4s infinite" } },
    ],
  },
  museum: {
    centerIcon: "🏛️",
    centerClass: "animate-celebration-bounce",
    auraColor: "rgb(224 174 86)",
    particles: [
      { emoji: "🎀", x: 20, y: 18, delay: 0, style: { animation: "confetti-fall 2.2s linear 0s infinite" } },
      { emoji: "🏆", x: 70, y: 20, delay: 0.5, style: { animation: "confetti-fall 2.2s linear 0.5s infinite" } },
      { emoji: "🖼️", x: 40, y: 16, delay: 0.9, style: { animation: "confetti-fall 2.2s linear 0.9s infinite" } },
      { emoji: "🎀", x: 86, y: 14, delay: 1.3, style: { animation: "confetti-fall 2.2s linear 1.3s infinite" } },
      { emoji: "✨", x: 55, y: 22, delay: 0.3, style: { animation: "twinkle 1.5s ease-in-out 0.3s infinite" } },
    ],
  },
  scholar: {
    centerIcon: "📚",
    centerClass: "animate-celebration-bounce",
    auraColor: "rgb(124 178 232)",
    particles: [
      { emoji: "📖", x: 14, y: 70, delay: 0 },
      { emoji: "🎓", x: 34, y: 78, delay: 0.5 },
      { emoji: "📜", x: 56, y: 74, delay: 0.9 },
      { emoji: "🎓", x: 74, y: 80, delay: 0.3 },
      { emoji: "📖", x: 88, y: 66, delay: 1.2 },
      { emoji: "✒️", x: 46, y: 84, delay: 1.5 },
    ].map((p) => ({ ...p, style: { animation: `book-float 2.6s ease-out ${p.delay}s infinite` } })),
  },
};

export default function ChallengeCelebration(props: CelebrationProps) {
  const effect = (): ThemeEffect => EFFECTS[props.theme] ?? EFFECTS.star;

  return (
    <div class="bg-surface-elevated rounded-xl p-6 border border-success/20 bg-success/5 relative overflow-hidden">
      {/* Particle layer */}
      <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
        <For each={effect().particles}>
          {(p) => (
            <span
              class="absolute text-xl select-none"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                "font-size": p.size ?? "1.4rem",
                ...p.style,
              }}
            >
              {p.emoji}
            </span>
          )}
        </For>
      </div>

      <div class="text-center space-y-3 relative z-10">
        {/* Central icon with a themed aura */}
        <div class="relative inline-flex items-center justify-center">
          <span
            class="absolute inset-0 -m-4 rounded-full blur-xl animate-aura-pulse"
            aria-hidden="true"
            style={{ "background-color": effect().auraColor, opacity: "0.4" }}
          />
          <div class={`text-5xl relative ${effect().centerClass}`}>{effect().centerIcon}</div>
        </div>

        <h2 class="text-xl font-display font-bold text-ink-primary">Challenge Complete!</h2>
        <p class="text-sm text-ink-secondary">Congratulations on finishing "{props.title}"</p>

        <div class="flex items-center justify-center gap-6 mt-3">
          <div class="text-center">
            <p class="text-2xl font-bold text-xp">+{props.rewardXp}</p>
            <p class="text-xs text-ink-secondary/60">XP Earned</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-coin">+{props.rewardCoins}</p>
            <p class="text-xs text-ink-secondary/60">Coins Earned</p>
          </div>
        </div>

        <div class="flex items-center justify-center gap-3 pt-2">
          <A
            href="/challenges/new"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Create Next Challenge
          </A>
          <button
            onClick={() => props.onRestart()}
            disabled={props.restarting}
            class={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              props.restarting
                ? "border-surface-border text-ink-secondary/50 cursor-not-allowed"
                : "border-accent text-accent hover:bg-accent/10"
            }`}
          >
            {props.restarting ? "Restarting..." : "Restart"}
          </button>
        </div>
      </div>
    </div>
  );
}

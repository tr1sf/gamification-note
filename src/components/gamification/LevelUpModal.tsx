import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { rewardQueue, type RewardEntry } from "~/stores/ui";

interface PendingLevelUp {
  newLevel: number;
  oldLevel: number;
  newTitle?: string;
  achievements?: string[];
}

export default function LevelUpModal() {
  const [pending, setPending] = createSignal<PendingLevelUp | null>(null);
  const [visible, setVisible] = createSignal(false);

  createEffect(() => {
    const queue = rewardQueue();
    const levelUpEntry = queue.find((r) => r.leveledUp);
    if (levelUpEntry && !pending()) {
      setPending({
        newLevel: levelUpEntry.newLevel!,
        oldLevel: levelUpEntry.newLevel! - 1,
        newTitle: levelUpEntry.newTitle,
        achievements: queue.filter((r) => r.achievement).map((r) => r.achievement!),
      });
      setVisible(true);
    }
  });

  let startTime = 0;
  let rafId: number;

  createEffect(() => {
    if (visible()) {
      startTime = performance.now();
      const anim = () => {
        if (performance.now() - startTime > 6000) {
          setVisible(false);
          setPending(null);
          return;
        }
        rafId = requestAnimationFrame(anim);
      };
      rafId = requestAnimationFrame(anim);
    }
    onCleanup(() => cancelAnimationFrame(rafId));
  });

  const dismiss = () => {
    setVisible(false);
    setPending(null);
  };

  return (
    <Show when={visible() && pending()}>
      <div class="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Level Up celebration">
        <div class="absolute inset-0 bg-surface-overlay/60" onClick={dismiss} />
        <div class="relative z-10 bg-surface-elevated border-2 border-accent rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl overflow-hidden">
          <div class="confetti-container" aria-hidden="true">
            <div class="confetti-piece" style="--x:10%;--color:#f59e0b;--delay:0s" />
            <div class="confetti-piece" style="--x:25%;--color:#3b82f6;--delay:0.3s" />
            <div class="confetti-piece" style="--x:40%;--color:#22c55e;--delay:0.6s" />
            <div class="confetti-piece" style="--x:55%;--color:#ef4444;--delay:0.9s" />
            <div class="confetti-piece" style="--x:70%;--color:#8b5cf6;--delay:1.2s" />
            <div class="confetti-piece" style="--x:85%;--color:#ec4899;--delay:1.5s" />
            <div class="confetti-piece" style="--x:15%;--color:#f59e0b;--delay:0.15s" />
            <div class="confetti-piece" style="--x:35%;--color:#3b82f6;--delay:0.45s" />
            <div class="confetti-piece" style="--x:50%;--color:#22c55e;--delay:0.75s" />
            <div class="confetti-piece" style="--x:65%;--color:#ef4444;--delay:1.05s" />
            <div class="confetti-piece" style="--x:80%;--color:#8b5cf6;--delay:1.35s" />
            <div class="confetti-piece" style="--x:95%;--color:#ec4899;--delay:1.65s" />
          </div>

          <p class="text-xl font-display font-bold text-accent mb-1">LEVEL UP!</p>
          <p class="text-5xl font-extrabold text-ink-primary my-3">
            {pending()!.oldLevel} <span class="text-ink-secondary mx-1">→</span> <span class="text-accent">{pending()!.newLevel}</span>
          </p>
          <Show when={pending()!.newTitle}>
            <p class="text-lg font-semibold text-ink-primary mb-4">
              {pending()!.newTitle}
            </p>
          </Show>
          <Show when={pending()!.achievements && pending()!.achievements!.length > 0}>
            <div class="mb-4 text-sm">
              <p class="text-ink-secondary mb-2">Unlocked Achievements:</p>
              <div class="flex flex-col gap-1">
                {pending()!.achievements!.map((ach) => (
                  <span class="text-ink-primary font-medium">🏆 {ach}</span>
                ))}
              </div>
            </div>
          </Show>
          <button
            onClick={dismiss}
            class="mt-4 px-6 py-2 bg-accent text-surface-overlay rounded-lg font-semibold hover:bg-accent-hover transition-colors"
          >
            Continue
          </button>
        </div>
      </div>

      <style>{`
        .confetti-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .confetti-piece {
          position: absolute;
          top: -10px;
          left: var(--x);
          width: 8px;
          height: 8px;
          background: var(--color);
          border-radius: 2px;
          animation: confetti-fall 3s ease-in var(--delay) forwards;
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(600px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </Show>
  );
}

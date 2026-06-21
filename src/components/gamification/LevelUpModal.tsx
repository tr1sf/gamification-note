import { createSignal, createEffect, For, Show } from "solid-js";
import { rewardQueue } from "~/stores/ui";
import Modal from "~/components/ui/Modal";
import Nelar from "~/components/mascot/Nelar";

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

  // No auto-dismiss: per WCAG 2.2.1 (Timing Adjustable), screen-reader users
  // must be able to read the level-up + achievements list without a hardcoded
  // 6-second rAF timer cutting them off. The user closes via Continue / Esc.

  const dismiss = () => {
    setVisible(false);
    setPending(null);
  };

  return (
    <Show when={visible() && pending()}>
      <Modal
        open={visible()}
        title="Level Up celebration"
        onDismiss={dismiss}
        class="border-2 border-accent max-w-sm text-center"
      >
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

        <Nelar state="happy" size={48} class="mx-auto mb-2" float />
        <h2 id="level-up-title" class="text-xl font-display font-bold text-accent mb-1">
          LEVEL UP!
        </h2>
        <p class="text-5xl font-extrabold text-ink-primary my-3">
          {pending()!.oldLevel}{" "}
          <span class="text-ink-secondary mx-1" aria-hidden="true">→</span>{" "}
          <span class="text-accent">{pending()!.newLevel}</span>
        </p>
        <Show when={pending()!.newTitle}>
          <p class="text-lg font-semibold text-ink-primary mb-4">
            {pending()!.newTitle}
          </p>
        </Show>
        <Show when={pending()!.achievements && pending()!.achievements!.length > 0}>
          <div class="mb-4 text-sm" aria-labelledby="level-up-ach-heading">
            <p id="level-up-ach-heading" class="text-ink-secondary mb-2">
              Unlocked Achievements:
            </p>
            <ul class="flex flex-col gap-1 list-none p-0">
              <For each={pending()!.achievements}>
                {(ach) => (
                  <li>
                    <span class="text-ink-primary font-medium">
                      <span aria-hidden="true">🏆 </span>{ach}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>
        <button
          type="button"
          onClick={dismiss}
          class="mt-4 px-6 py-2 bg-accent text-surface-overlay rounded-lg font-semibold hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
        >
          Continue
        </button>

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
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            50% { opacity: 1; }
            100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
          }
        `}</style>
      </Modal>
    </Show>
  );
}

import { createSignal, onMount, onCleanup, For, Show } from "solid-js";

interface TourStep {
  selector: string;
  title: string;
  description: string;
  icon: string;
  side: "left" | "right" | "bottom" | "top";
}

const STORAGE_KEY = "tavernotex_welcome_tour_seen";

const STEPS: TourStep[] = [
  {
    selector: 'a[href="/tavern"]',
    title: "How TavernoteX Works",
    description: "Write notes → Earn XP → Level up → Unlock features → Fight bosses. Better-structured notes earn more XP and deal more damage. This is your gamified learning loop!",
    icon: "🔄",
    side: "right",
  },
  {
    selector: 'a[href="/tavern"]',
    title: "Tavern Hall",
    description: "Your home base. See your stats, active quests, and daily limits. Check in daily to maintain your streak and boost your XP cap.",
    icon: "🏰",
    side: "right",
  },
  {
    selector: 'a[href="/notes"]',
    title: "My Scrolls",
    description: "Write and organize your notes here. Every note earns XP and coins. Longer, well-structured notes deal more damage to bosses!",
    icon: "📜",
    side: "right",
  },
  {
    selector: 'a[href="/quests"]',
    title: "Quests",
    description: "Daily and weekly tasks that reward bonus XP and coins. Check back often — new quests refresh every day!",
    icon: "📋",
    side: "right",
  },
  {
    selector: 'a[href="/boss/active"], a[href*="/boss/active"]',
    title: "Boss Fight",
    description: "A daily and weekly boss appear automatically. Attack them by writing notes, taking quizzes, and completing habits. Each boss has a unique ability — find their weakness!",
    icon: "⚔️",
    side: "right",
  },
  {
    selector: 'button[aria-label*="daily"], [class*="daily-limits"], header button:first-of-type',
    title: "Daily Limits",
    description: "Your daily XP and coin earning cap. Resets at midnight UTC (7am Vietnam). The streak bonus increases your daily cap — keep logging in!",
    icon: "🎁",
    side: "bottom",
  },
  {
    selector: 'a[href="/profile"]',
    title: "Your Character",
    description: "View your level, XP progress, inventory, and equipped cosmetics. Spend coins at the Shop to customize your avatar with frames, badges, and colored names.",
    icon: "🛡️",
    side: "right",
  },
];

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 768;

export function hasSeenTour(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function resetTour(): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

export default function WelcomeTour(props: { onComplete: () => void }) {
  const [step, setStep] = createSignal(0);
  const [pos, setPos] = createSignal({ top: "80px", left: "50%", transform: "translateX(-50%)" });
  const [visible, setVisible] = createSignal(false);
  const [targetMissed, setTargetMissed] = createSignal(false);
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  function getTarget(): Element | null {
    const s = STEPS[step()];
    if (!s) return null;
    return document.querySelector(s.selector);
  }

  function updatePosition() {
    const target = getTarget();
    if (!target) {
      setVisible(true);
      setTargetMissed(true);
      setPos({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }

    setTargetMissed(false);
    const rect = target.getBoundingClientRect();
    const cardW = Math.min(340, window.innerWidth - 32);
    const current = STEPS[step()];
    const side = isMobile() ? "bottom" : current.side;

    const gap = 14;
    let topPx = 0;
    let leftStr = "50%";
    let transform = "";

    switch (side) {
      case "right":
        topPx = rect.top + rect.height / 2;
        leftStr = `${rect.right + gap}px`;
        transform = "translateY(-50%)";
        break;
      case "left":
        topPx = rect.top + rect.height / 2;
        leftStr = `${rect.left - gap - cardW}px`;
        transform = "translateY(-50%)";
        break;
      case "top":
        topPx = rect.top - gap;
        leftStr = `${rect.left + rect.width / 2}px`;
        transform = "translate(-50%, -100%)";
        break;
      case "bottom":
      default:
        topPx = rect.bottom + gap;
        leftStr = "50%";
        transform = "translateX(-50%)";
        break;
    }

    // Clamp to viewport
    if (topPx < 10) topPx = 10;
    if (topPx > window.innerHeight - 200) topPx = window.innerHeight - 200;
    const topStr = `${topPx}px`;

    setPos({ top: topStr, left: leftStr, transform });
    setVisible(true);
  }

  function highlightTarget() {
    // Remove previous highlights
    document.querySelectorAll("[data-tour-highlight]").forEach((el) => {
      (el as HTMLElement).style.outline = "";
      (el as HTMLElement).style.outlineOffset = "";
      el.removeAttribute("data-tour-highlight");
    });
    const target = getTarget();
    if (target) {
      (target as HTMLElement).style.outline = "3px solid var(--color-accent, #6366f1)";
      (target as HTMLElement).style.outlineOffset = "4px";
      (target as HTMLElement).style.zIndex = "60";
      target.setAttribute("data-tour-highlight", "1");
    }
  }

  function cleanupHighlights() {
    document.querySelectorAll("[data-tour-highlight]").forEach((el) => {
      (el as HTMLElement).style.outline = "";
      (el as HTMLElement).style.outlineOffset = "";
      (el as HTMLElement).style.zIndex = "";
      el.removeAttribute("data-tour-highlight");
    });
  }

  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updatePosition, 100);
  }

  function nextStep() {
    if (step() < STEPS.length - 1) {
      setVisible(false);
      setTimeout(() => {
        setStep((s) => s + 1);
        setTimeout(() => {
          highlightTarget();
          updatePosition();
        }, 50);
      }, 150);
    } else {
      finish();
    }
  }

  function prevStep() {
    if (step() > 0) {
      setVisible(false);
      setTimeout(() => {
        setStep((s) => s - 1);
        setTimeout(() => {
          highlightTarget();
          updatePosition();
        }, 50);
      }, 150);
    }
  }

  function finish() {
    cleanupHighlights();
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    props.onComplete();
  }

  onMount(() => {
    if (hasSeenTour()) {
      props.onComplete();
      return;
    }
    setTimeout(() => {
      highlightTarget();
      updatePosition();
    }, 800);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", updatePosition);
  });

  onCleanup(() => {
    cleanupHighlights();
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("scroll", updatePosition);
    if (resizeTimer) clearTimeout(resizeTimer);
  });

  const current = () => STEPS[step()];
  const isLast = () => step() === STEPS.length - 1;
  const isFirst = () => step() === 0;

  return (
    <div class="fixed inset-0 z-50">
      {/* semi-transparent backdrop */}
      <div class="absolute inset-0 bg-black/60" />

      {/* Target area glow — punch a brighter spot over the target */}
      <Show when={!targetMissed()}>
        <div
          class="absolute w-10 h-10 rounded-xl bg-accent/5 ring-2 ring-accent/30 shadow-[0_0_30px_var(--color-accent)_/_0.15] pointer-events-none"
          style={{
            top: pos().top,
            left: pos().left,
            transform: pos().transform,
            opacity: visible() ? 1 : 0,
            transition: "all 0.3s ease",
          }}
        />
      </Show>

      {/* Tooltip card */}
      <div
        class="absolute bg-surface-elevated border border-surface-border rounded-2xl shadow-2xl p-5"
        style={{
          top: pos().top,
          left: pos().left,
          transform: pos().transform,
          opacity: visible() ? 1 : 0,
          transition: "opacity 0.3s ease, top 0.3s ease, left 0.3s ease",
          "max-width": "min(340px, calc(100vw - 24px))",
          width: "min(340px, calc(100vw - 24px))",
        }}
      >
        <div class="flex items-center gap-3 mb-2">
          <span class="text-2xl">{current().icon}</span>
          <div>
            <h3 class="font-bold text-ink-primary text-lg leading-tight">{current().title}</h3>
            <p class="text-xs text-ink-muted">Step {step() + 1} of {STEPS.length}</p>
          </div>
        </div>
        <p class="text-sm text-ink-secondary leading-relaxed mb-4">{current().description}</p>

        {/* Step dots */}
        <div class="flex items-center justify-center gap-1.5 mb-3">
          <For each={STEPS}>
            {(_, i) => (
              <button
                onClick={() => { setVisible(false); setTimeout(() => { setStep(i()); highlightTarget(); updatePosition(); setTimeout(() => setVisible(true), 50); }, 150); }}
                class={`w-2 h-2 rounded-full transition-all ${i() === step() ? "bg-accent w-4" : "bg-surface-border hover:bg-ink-muted"}`}
              >
                <span class="sr-only">Step {i() + 1}</span>
              </button>
            )}
          </For>
        </div>

        <div class="flex items-center justify-between">
          <button
            onClick={prevStep}
            class={`text-sm px-3 py-1.5 rounded-lg transition-colors ${isFirst() ? "text-ink-tertiary cursor-default" : "text-ink-secondary hover:text-ink-primary hover:bg-surface-hover"}`}
            disabled={isFirst()}
          >
            ← Back
          </button>
          <button onClick={finish} class="text-sm text-ink-muted hover:text-ink-secondary px-3 py-1.5">
            Skip tour
          </button>
          <button
            onClick={nextStep}
            class="text-sm px-4 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
          >
            {isLast() ? "Got it! 🎉" : "Next →"}
          </button>
        </div>
      </div>

      {/* Mobile fallback: if target not found, show centered card */}
      <Show when={targetMissed()}>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div
            class="bg-surface-elevated border border-surface-border rounded-2xl shadow-2xl p-5 w-full max-w-sm"
            style={{ opacity: visible() ? 1 : 0, transition: "opacity 0.3s ease" }}
          >
            <div class="flex items-center gap-3 mb-2">
              <span class="text-2xl">{current().icon}</span>
              <div>
                <h3 class="font-bold text-ink-primary text-lg leading-tight">{current().title}</h3>
                <p class="text-xs text-ink-muted">Step {step() + 1} of {STEPS.length}</p>
              </div>
            </div>
            <p class="text-sm text-ink-secondary leading-relaxed mb-4">{current().description}</p>
            <div class="flex items-center justify-between">
              <button onClick={prevStep} class={`text-sm px-3 py-1.5 rounded-lg ${isFirst() ? "text-ink-tertiary cursor-default" : "text-ink-secondary hover:text-ink-primary"}`} disabled={isFirst()}>← Back</button>
              <button onClick={finish} class="text-sm text-ink-muted hover:text-ink-secondary">Skip tour</button>
              <button onClick={nextStep} class="text-sm px-4 py-1.5 rounded-lg bg-accent text-white font-medium">{isLast() ? "Got it! 🎉" : "Next →"}</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

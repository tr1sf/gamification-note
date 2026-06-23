import { createSignal, onMount, Show } from "solid-js";
import { gamification } from "~/stores/user";

const STORAGE_KEY = "tavernotex_streak_milestones_celebrated";

const MILESTONES = [
  { days: 3, message: "3-day streak! The fire is lit." },
  { days: 7, message: "7-day streak! You're on a roll!" },
  { days: 14, message: "14 days! The tavern feels your presence." },
  { days: 30, message: "30 DAY STREAK! You are a legend!" },
  { days: 60, message: "60 days! The tavern has a statue of you!" },
  { days: 100, message: "100 DAYS! You are the Tavern Master!" },
];

function getCelebrated(): number[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function markCelebrated(days: number) {
  const list = getCelebrated();
  list.push(days);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function checkStreakMilestone(): { days: number; message: string } | null {
  const streak = gamification().streak;
  if (streak < 3) return null;
  const celebrated = getCelebrated();
  for (const m of MILESTONES) {
    if (streak >= m.days && !celebrated.includes(m.days)) {
      markCelebrated(m.days);
      return m;
    }
  }
  return null;
}

export default function StreakCelebration(props: { onComplete: () => void }) {
  const [visible, setVisible] = createSignal(false);
  const [msg, setMsg] = createSignal("");

  onMount(() => {
    const milestone = checkStreakMilestone();
    if (milestone) {
      setMsg(milestone.message);
      setTimeout(() => setVisible(true), 500);
      setTimeout(() => {
        setVisible(false);
        props.onComplete();
      }, 4000);
    } else {
      props.onComplete();
    }
  });

  return (
    <Show when={visible()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={() => { setVisible(false); props.onComplete(); }}
      >
        <div
          class="bg-surface-elevated rounded-2xl p-8 border border-amber-500/30 text-center max-w-sm mx-4 shadow-2xl"
          style={{ animation: "fade-up 0.5s ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p class="text-5xl mb-4">🔥</p>
          <h2 class="text-2xl font-display font-bold text-ink-primary mb-2">Streak Milestone!</h2>
          <p class="text-lg text-amber-400 font-semibold mb-2">{msg()}</p>
          <p class="text-sm text-ink-secondary">
            {gamification().streak} days and counting. Keep the fire alive!
          </p>
        </div>
      </div>
    </Show>
  );
}

import { createEffect, createSignal } from "solid-js";

interface StreakTrackerProps {
  streak: number;
  compact?: boolean;
}

export default function StreakTracker(props: StreakTrackerProps) {
  const [animating, setAnimating] = createSignal(false);
  let prevStreak = props.streak;

  createEffect(() => {
    if (props.streak > prevStreak) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }
    prevStreak = props.streak;
  });

  return (
    <div
      class={`inline-flex items-center gap-1 font-bold ${
        props.compact ? "text-xs" : "text-sm"
      } text-coin`}
      aria-label={`${props.streak}-day streak`}
    >
      <span
        aria-hidden="true"
        class={`${animating() ? "animate-bounce" : ""} text-base`}
      >
        🔥
      </span>
      <span classList={{ "scale-125 transition-transform duration-300": animating() }}>
        {props.streak}
      </span>
    </div>
  );
}

import { For, Show, createMemo } from "solid-js";
import { gamification } from "~/stores/user";

/**
 * StreakCalendar — visual 7-day calendar showing which days the user
 * has checked in. Rewards milestone streaks with visual flair.
 * Reads streak from the gamification store (updated on login).
 */
export default function StreakCalendar() {
  const streak = () => gamification().streak ?? 0;

  // Last 7 days, oldest → newest. Day 0 = 6 days ago, Day 6 = today.
  const days = createMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: { date: Date; label: string; checkedIn: boolean; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      // "Checked in" if within streak range: days from today back (streak - 1) are checked.
      const daysAgo = i;
      const checkedIn = daysAgo < streak();
      result.push({
        date: d,
        label: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()],
        checkedIn,
        isToday: i === 0,
      });
    }
    return result;
  });

  const streakMilestone = () => {
    if (streak() >= 30) return { icon: "🔥", label: "Legend", color: "text-coin" };
    if (streak() >= 14) return { icon: "⚡", label: "On Fire", color: "text-error" };
    if (streak() >= 7) return { icon: "🌟", label: "Steady", color: "text-accent" };
    if (streak() >= 3) return { icon: "✨", label: "Warming Up", color: "text-xp" };
    return { icon: "🌙", label: "Getting Started", color: "text-ink-secondary" };
  };

  const nextMilestone = () => {
    if (streak() < 3) return 3;
    if (streak() < 7) return 7;
    if (streak() < 14) return 14;
    if (streak() < 30) return 30;
    if (streak() < 60) return 60;
    return 100;
  };

  const progressToNext = () => {
    const next = nextMilestone();
    const prev = streak() < 3 ? 0 : streak() < 7 ? 3 : streak() < 14 ? 7 : streak() < 30 ? 14 : streak() < 60 ? 30 : 60;
    return Math.min(100, Math.round(((streak() - prev) / (next - prev)) * 100));
  };

  return (
    <div class="bg-surface-elevated rounded-xl p-4 border border-surface-border">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-ink-primary">📅 Daily Streak</h3>
        <span class={`text-xs font-bold ${streakMilestone().color}`}>
          {streakMilestone().icon} {streakMilestone().label}
        </span>
      </div>

      {/* 7-day calendar */}
      <div class="flex items-center justify-between gap-1 mb-3">
        <For each={days()}>
          {(day) => (
            <div class="flex flex-col items-center gap-1">
              <span class="text-[0.6rem] text-ink-tertiary font-medium">{day.label}</span>
              <div
                class={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                  day.checkedIn
                    ? day.isToday
                      ? "bg-accent text-surface-overlay ring-2 ring-accent/30"
                      : "bg-success/20 text-success"
                    : day.isToday
                    ? "border-2 border-dashed border-accent/40 text-ink-tertiary"
                    : "bg-surface-border text-ink-tertiary/50"
                }`}
                aria-label={`${day.label}: ${day.checkedIn ? "checked in" : "missed"}`}
              >
                {day.checkedIn ? "✓" : day.date.getDate()}
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Streak count + milestone progress */}
      <div class="flex items-center justify-between text-xs text-ink-secondary mb-1">
        <span class="font-bold text-accent text-base">{streak()} day streak</span>
        <span>Next: {nextMilestone()} days</span>
      </div>
      <div class="h-2 bg-surface-border rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-accent to-coin rounded-full transition-all duration-500"
          style={{ width: `${progressToNext()}%` }}
        />
      </div>
    </div>
  );
}

interface DailyStreakProps {
  streakDays: number[];
  currentStreak: number;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function DailyStreak(props: DailyStreakProps) {
  const days = () => {
    const result = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const hasStreak = props.streakDays.some(
        (sd) => new Date(sd).toISOString().split("T")[0] === dateStr
      );
      result.push({ date: dateStr, active: hasStreak });
    }
    return result;
  };

  const weeks = () => {
    const allDays = days();
    const weeks: Array<Array<{ date: string; active: boolean }>> = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }
    return weeks;
  };

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-primary flex items-center gap-1">
          <span aria-hidden="true">🔥</span>
          {props.currentStreak}-day streak
        </span>
      </div>
      <div class="flex gap-0.5">
        <div class="flex flex-col gap-0.5 mr-1">
          {DAY_LABELS.map((label) => (
            <span class="text-[10px] text-ink-secondary w-4 h-3 flex items-center justify-center leading-none">
              {label}
            </span>
          ))}
        </div>
        <div class="flex gap-0.5">
          {weeks().map((week) => (
            <div class="flex flex-col gap-0.5">
              {week.map((day) => (
                <div
                  class={`w-3 h-3 rounded-sm ${
                    day.active ? "bg-accent" : "bg-surface-border"
                  }`}
                  title={day.date}
                  role="img"
                  aria-label={day.active ? `Streak day: ${day.date}` : `No streak: ${day.date}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

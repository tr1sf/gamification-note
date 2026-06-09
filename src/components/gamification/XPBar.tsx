import { xpProgressInLevel, xpForLevel } from "~/stores/user";

interface XPBarProps {
  xp: number;
  level: number;
  compact?: boolean;
}

export default function XPBar(props: XPBarProps) {
  const progress = () => xpProgressInLevel(props.xp, props.level);
  const pct = () => {
    const { current, needed } = progress();
    if (needed <= 0) return 100;
    return Math.min(100, Math.round((current / needed) * 100));
  };
  const nextLevelXp = () => xpForLevel(props.level);

  return (
    <div
      class={`${props.compact ? "w-[200px]" : "w-full"}`}
      role="progressbar"
      aria-valuenow={progress().current}
      aria-valuemin={0}
      aria-valuemax={progress().needed}
      aria-label={`XP progress: ${progress().current} of ${progress().needed} towards level ${props.level + 1}`}
    >
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-ink-secondary font-medium">
          XP: {progress().current.toLocaleString()} / {progress().needed.toLocaleString()}
        </span>
        <span class="text-xs text-xp font-bold">Lv.{props.level}</span>
      </div>
      <div class="h-2 bg-surface-border rounded-full overflow-hidden">
        <div
          class="h-full bg-xp rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct()}%` }}
        />
      </div>
    </div>
  );
}

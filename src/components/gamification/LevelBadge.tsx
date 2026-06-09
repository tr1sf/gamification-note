interface LevelBadgeProps {
  level: number;
  title: string;
}

export default function LevelBadge(props: LevelBadgeProps) {
  return (
    <span
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20"
      aria-label={`Level ${props.level}, ${props.title}`}
    >
      <span class="font-mono">Lv.{props.level}</span>
      <span aria-hidden="true" class="opacity-50">·</span>
      <span class="truncate max-w-[120px]">{props.title}</span>
    </span>
  );
}

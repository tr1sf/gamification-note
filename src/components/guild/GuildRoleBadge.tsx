interface GuildRoleBadgeProps {
  name: string;
  color: string;
  compact?: boolean;
}

export default function GuildRoleBadge(props: GuildRoleBadgeProps) {
  return (
    <span
      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
      style={{
        "background-color": `${props.color}15`,
        "border-color": `${props.color}30`,
        color: props.color,
      }}
    >
      {props.name}
    </span>
  );
}

import { useNavigate } from "@solidjs/router";
import type { Guild } from "~/stores/guild";

interface GuildCardProps {
  guild: Guild;
}

export default function GuildCard(props: GuildCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/guilds/${props.guild.id}`);
  };

  return (
    <div
      class="p-4 rounded-lg border border-surface-border bg-surface-elevated hover:shadow transition-shadow cursor-pointer"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Guild: ${props.guild.name}`}
    >
      <div class="flex items-start justify-between mb-2">
        <h3 class="font-medium text-ink-primary truncate flex-1">{props.guild.name}</h3>
        <span
          class={`text-xs px-2 py-0.5 rounded shrink-0 ml-2 ${
            props.guild.isPublic
              ? "bg-success-bg text-success"
              : "bg-surface-border text-ink-secondary"
          }`}
        >
          {props.guild.isPublic ? "Public" : "Private"}
        </span>
      </div>

      <p class="text-sm text-ink-secondary line-clamp-2 mb-3">
        {props.guild.description || "No description"}
      </p>

      <div class="flex items-center gap-3 text-xs text-ink-secondary">
        <span class="inline-flex items-center gap-1">
          <span aria-hidden="true">👥</span>
          {props.guild.memberCount} members
        </span>
        <span>
          {new Date(props.guild.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

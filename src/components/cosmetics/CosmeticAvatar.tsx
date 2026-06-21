import { Show } from "solid-js";
import type { EquippedCosmetics } from "~/lib/cosmetics/equipped";

const frameStyles: Record<string, { border: string; glow: string; ring: string }> = {
  common: {
    border: "border-ink-secondary/40",
    glow: "",
    ring: "bg-ink-secondary/20",
  },
  uncommon: {
    border: "border-green-500/70",
    glow: "shadow-[0_0_10px_rgba(34,197,94,0.35)]",
    ring: "bg-green-500/30",
  },
  rare: {
    border: "border-blue-500/70",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.4)]",
    ring: "bg-blue-500/30",
  },
  epic: {
    border: "border-purple-500/70",
    glow: "shadow-[0_0_14px_rgba(168,85,247,0.45)]",
    ring: "bg-purple-500/30",
  },
  legendary: {
    border: "border-coin/80",
    glow: "shadow-[0_0_16px_rgba(245,158,11,0.5)]",
    ring: "bg-coin/40",
  },
};

const sizeMap = {
  sm: { avatar: "w-7 h-7 sm:w-8 sm:h-8", text: "text-xs", ring: "-inset-1.5" },
  md: { avatar: "w-9 h-9", text: "text-sm", ring: "-inset-2" },
  lg: { avatar: "w-20 h-20", text: "text-3xl", ring: "-inset-2" },
};

interface CosmeticAvatarProps {
  username: string;
  avatarUrl: string | null;
  equipped?: EquippedCosmetics;
  size?: "sm" | "md" | "lg";
  class?: string;
}

export default function CosmeticAvatar(props: CosmeticAvatarProps) {
  const size = () => sizeMap[props.size ?? "md"];
  const frame = () => props.equipped?.avatarFrame;
  const frameStyle = () => frameStyles[frame()?.rarity ?? "common"] || frameStyles.common;
  const initial = () => props.username.charAt(0).toUpperCase();

  return (
    <div class={`relative shrink-0 ${props.class ?? ""}`} aria-label={props.username}>
      <Show when={frame()}>
        <div
          class={`absolute ${size().ring} rounded-full ${frameStyle().ring} animate-pulse opacity-60 pointer-events-none`}
          aria-hidden="true"
        />
      </Show>

      <div
        class={`${size().avatar} rounded-full bg-accent/20 flex items-center justify-center ${size().text} font-bold overflow-hidden border-[3px] ${frameStyle().border} ${frameStyle().glow}`}
      >
        <Show
          when={props.avatarUrl}
          fallback={<span class="text-accent">{initial()}</span>}
        >
          <img src={props.avatarUrl!} alt={props.username} class="w-full h-full object-cover" />
        </Show>

        <Show when={frame()?.imageUrl}>
          <img
            src={frame()?.imageUrl ?? undefined}
            alt=""
            class="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        </Show>
      </div>

      <Show when={props.equipped?.badge}>
        <span
          class="absolute -bottom-0.5 -right-0.5 text-xs bg-surface rounded-full border border-surface-border px-0.5 shadow-sm"
          title={props.equipped!.badge!.name}
        >
          {props.equipped!.badge!.icon && (props.equipped!.badge!.icon.startsWith("/assets/") || props.equipped!.badge!.icon.startsWith("http"))
            ? <img src={props.equipped!.badge!.icon} alt="" class="w-3.5 h-3.5 object-contain rounded" />
            : <span>{props.equipped!.badge!.icon}</span>
          }
        </span>
      </Show>
    </div>
  );
}

export function CosmeticName(props: {
  username: string;
  equipped?: EquippedCosmetics;
  class?: string;
}) {
  const color = () => props.equipped?.nameColor?.color;
  return (
    <span class={props.class} style={color() ? { color: color()! } : undefined}>
      {props.username}
    </span>
  );
}

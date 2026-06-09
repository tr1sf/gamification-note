import { For, Show } from "solid-js";
import type { GuildMember } from "~/stores/guild";

interface MemberListProps {
  members: GuildMember[];
  currentUserId?: string;
}

export default function MemberList(props: MemberListProps) {
  return (
    <div class="space-y-1">
      <Show
        when={props.members.length > 0}
        fallback={
          <div class="text-center py-8 text-ink-secondary">
            <p class="text-3xl mb-2">👥</p>
            <p class="text-sm">No members yet</p>
          </div>
        }
      >
        <For each={props.members}>
          {(member) => {
            const roleBadge = () => {
              if (member.role === "owner") {
                return (
                  <span class="text-xs px-1.5 py-0.5 rounded bg-coin/20 text-coin font-medium">
                    Owner
                  </span>
                );
              }
              if (member.role === "admin") {
                return (
                  <span class="text-xs px-1.5 py-0.5 rounded bg-surface-border text-ink-secondary font-medium">
                    Admin
                  </span>
                );
              }
              return null;
            };

            return (
              <div
                class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition-colors"
                classList={{ "bg-accent/5": member.userId === props.currentUserId }}
              >
                <div
                  class="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold shrink-0"
                  aria-label={member.user.username}
                >
                  {member.user.username.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-ink-primary truncate">
                      {member.user.username}
                    </span>
                    {member.userId === props.currentUserId && (
                      <span class="text-xs text-ink-secondary">(you)</span>
                    )}
                    {roleBadge()}
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs font-mono text-xp font-semibold">
                      Lv.{member.user.level}
                    </span>
                    <span class="text-xs text-ink-secondary truncate">
                      {member.user.title}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}

import { For, Show } from "solid-js";
import type { GuildMember } from "~/stores/guild";

type Role = "owner" | "admin" | "member";

interface MemberListProps {
  members: GuildMember[];
  currentUserId?: string;
  currentUserRole?: Role;
  onPromote?: (userId: string) => void;
  onDemote?: (userId: string) => void;
  onTransfer?: (userId: string) => void;
  onKick?: (userId: string) => void;
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
            const isSelf = () => member.userId === props.currentUserId;
            const myRole = () => props.currentUserRole;
            // Owner can manage everyone but themselves; admin can only kick plain members.
            const canPromote = () => myRole() === "owner" && !isSelf() && member.role === "member";
            const canDemote = () => myRole() === "owner" && !isSelf() && member.role === "admin";
            const canTransfer = () => myRole() === "owner" && !isSelf() && member.role === "admin";
            const canKick = () =>
              !isSelf() &&
              member.role !== "owner" &&
              (myRole() === "owner" || (myRole() === "admin" && member.role === "member"));
            const hasActions = () => canPromote() || canDemote() || canTransfer() || canKick();

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
                classList={{ "bg-accent/5": isSelf() }}
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
                    {isSelf() && (
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

                <Show when={hasActions()}>
                  <div class="flex items-center gap-1 shrink-0">
                    <Show when={canPromote()}>
                      <button
                        onClick={() => props.onPromote?.(member.userId)}
                        class="text-xs px-2 py-1 rounded border border-surface-border text-ink-secondary hover:border-accent hover:text-accent transition-colors"
                        title="Promote to admin"
                      >
                        Promote
                      </button>
                    </Show>
                    <Show when={canDemote()}>
                      <button
                        onClick={() => props.onDemote?.(member.userId)}
                        class="text-xs px-2 py-1 rounded border border-surface-border text-ink-secondary hover:border-accent hover:text-accent transition-colors"
                        title="Demote to member"
                      >
                        Demote
                      </button>
                    </Show>
                    <Show when={canTransfer()}>
                      <button
                        onClick={() => props.onTransfer?.(member.userId)}
                        class="text-xs px-2 py-1 rounded border border-surface-border text-coin hover:border-coin transition-colors"
                        title="Transfer ownership"
                      >
                        Make owner
                      </button>
                    </Show>
                    <Show when={canKick()}>
                      <button
                        onClick={() => props.onKick?.(member.userId)}
                        class="text-xs px-2 py-1 rounded border border-surface-border text-ink-secondary hover:border-error hover:text-error transition-colors"
                        title="Remove from guild"
                      >
                        Kick
                      </button>
                    </Show>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}

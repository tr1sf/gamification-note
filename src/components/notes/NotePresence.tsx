import { Show } from "solid-js";
import { user } from "~/stores/auth";

interface NotePresenceProps {
  noteId: string;
  isEditing: boolean;
  viewers: Array<{ userId: string; username: string }>;
  editingUser: { userId: string; username: string } | null;
  connected: boolean;
}

export default function NotePresence(props: NotePresenceProps) {
  const currentUser = () => user();
  const otherViewers = () =>
    props.viewers.filter((v) => v.userId !== currentUser()?.id);

  const viewerCount = () => otherViewers().length;

  return (
    <div class="flex items-center gap-2 text-xs text-ink-secondary">
      <Show when={props.editingUser && props.editingUser.userId !== currentUser()?.id}>
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-coin/10 text-coin border border-coin/20 animate-pulse">
          <span class="w-1.5 h-1.5 rounded-full bg-coin" />
          <span class="truncate max-w-[120px] font-medium">
            {props.editingUser!.username} is editing...
          </span>
        </div>
      </Show>

      <Show when={props.isEditing}>
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
          <span class="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>You are editing</span>
        </div>
      </Show>

      <Show when={viewerCount() > 0 && !props.isEditing}>
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-elevated">
          <span aria-hidden="true">👁️</span>
          <span>
            {viewerCount()} {viewerCount() === 1 ? "viewer" : "viewers"}
          </span>
        </div>
      </Show>

      <Show when={!props.connected}>
        <span class="text-error text-xs">Offline</span>
      </Show>
    </div>
  );
}

import { createSignal, onMount, onCleanup } from "solid-js";
import { useSocket } from "~/lib/socket/client";

export function useNotePresence(noteId: string) {
  const { socket, emit, on, off, connected } = useSocket();
  const [viewers, setViewers] = createSignal<Array<{ userId: string; username: string }>>([]);
  const [editingUser, setEditingUser] = createSignal<{ userId: string; username: string } | null>(null);

  onMount(() => {
    emit("note:join", { noteId });

    const handleJoin = (data: { userId: string; username: string }) => {
      setViewers((prev) => {
        if (prev.some((v) => v.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, username: data.username }];
      });
    };

    const handleLeave = (data: { userId: string; username: string }) => {
      setViewers((prev) => prev.filter((v) => v.userId !== data.userId));
    };

    const handleEditingStart = (data: { userId: string; username: string }) => {
      setEditingUser({ userId: data.userId, username: data.username });
    };

    const handleEditingEnd = (data: { userId: string }) => {
      setEditingUser(null);
    };

    on("note:user-joined", handleJoin);
    on("note:user-left", handleLeave);
    on("note:editing-started", handleEditingStart);
    on("note:editing-ended", handleEditingEnd);

    onCleanup(() => {
      emit("note:leave", { noteId });
      off("note:user-joined", handleJoin);
      off("note:user-left", handleLeave);
      off("note:editing-started", handleEditingStart);
      off("note:editing-ended", handleEditingEnd);
    });
  });

  return {
    viewers,
    editingUser,
    connected,
  };
}

export function useEditLock(noteId: string) {
  const { emit, on, off } = useSocket();
  const [lockedBy, setLockedBy] = createSignal<{ userId: string; username: string } | null>(null);

  onMount(() => {
    const handleEditingStart = (data: { userId: string; username: string }) => {
      setLockedBy({ userId: data.userId, username: data.username });
    };

    const handleEditingEnd = (data: { userId: string }) => {
      setLockedBy(null);
    };

    on("note:editing-started", handleEditingStart);
    on("note:editing-ended", handleEditingEnd);

    onCleanup(() => {
      off("note:editing-started", handleEditingStart);
      off("note:editing-ended", handleEditingEnd);
    });
  });

  return {
    isLocked: () => lockedBy() !== null,
    lockedBy,
    startEditing: () => emit("note:editing-start", { noteId }),
    stopEditing: () => emit("note:editing-end", { noteId }),
  };
}

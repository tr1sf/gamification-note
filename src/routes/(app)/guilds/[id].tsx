import { createSignal, createMemo, Show, onMount, onCleanup } from "solid-js";
import { useParams, useSearchParams, useNavigate } from "@solidjs/router";
import { user, authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import {
  fetchGuild,
  fetchMembers,
  fetchMessages,
  joinGuild,
  leaveGuild,
  regenerateInvite,
  updateMemberRole,
  kickMember,
  fetchGuildNotes,
  shareNoteToGuild,
  unshareNoteFromGuild,
  addSocketMessage,
  fetchGoals,
  type Guild,
  type GuildMember,
  type ChatMessage,
  type GuildNote,
  type GuildGoal,
} from "~/stores/guild";
import { startDirectConversation } from "~/stores/dm";
import { fetchTasks, type GuildTask } from "~/stores/tasks";
import { useSocket } from "~/lib/socket/client";
import GuildChat from "~/components/guild/GuildChat";
import MemberList from "~/components/guild/MemberList";
import GuildNotes from "~/components/guild/GuildNotes";
import GuildTasks from "~/components/guild/GuildTasks";
import GuildGoals from "~/components/guild/GuildGoals";
import ConfirmModal from "~/components/ui/ConfirmModal";
import Nelar from "~/components/mascot/Nelar";

type Role = "owner" | "admin" | "member";

export default function GuildDetailPage() {
  const params = useParams();
  const guildId = () => params.id as string;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket, on, off, emit, ensureConnected } = useSocket();

  const [guild, setGuild] = createSignal<Guild | null>(null);
  const [members, setMembers] = createSignal<GuildMember[]>([]);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [notes, setNotes] = createSignal<GuildNote[]>([]);
  const [tasks, setTasks] = createSignal<GuildTask[]>([]);
  const [goals, setGoals] = createSignal<GuildGoal[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [tab, setTab] = createSignal<"chat" | "scrolls" | "tasks" | "goals" | "members">("chat");
  const [joining, setJoining] = createSignal(false);
  const [leaving, setLeaving] = createSignal(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = createSignal(false);
  const [inviteInput, setInviteInput] = createSignal(
    typeof searchParams.code === "string" ? searchParams.code : ""
  );
  const [copied, setCopied] = createSignal(false);
  // Tracks whether the user already left via handleLeave so the onCleanup
  // guild:leave emit doesn't double-fire for a user who's no longer a member.
  let hasLeftManually = false;

  const currentUser = () => user();
  const isMember = createMemo(() => {
    const u = currentUser();
    return members().some((m) => m.userId === u?.id);
  });
  const isOwner = () => guild()?.ownerId === currentUser()?.id;
  const myRole = createMemo<Role | undefined>(() => {
    if (isOwner()) return "owner";
    return members().find((m) => m.userId === currentUser()?.id)?.role as Role | undefined;
  });
  const canModerate = () => myRole() === "owner" || myRole() === "admin";

  const refreshMembers = async () => setMembers(await fetchMembers(guildId()));
  const refreshNotes = async () => setNotes(await fetchGuildNotes(guildId()));
  const refreshTasks = async (): Promise<void> => {
    setTasks(await fetchTasks(guildId()));
  };
  const refreshGoals = async (): Promise<void> => {
    setGoals(await fetchGoals(guildId()));
  };

  const enterSocketRoom = () => {
    // Only join the socket room if we are actually a member. The server rejects
    // non-members anyway, but joining blindly floods the client with error events.
    if (!isMember()) return;
    // Ensure a connection is in flight; the join is buffered and delivered once
    // connected, so we don't have to gate on the current connection state.
    ensureConnected();
    emit("guild:join", { guildId: guildId() });
  };

  onMount(async () => {
    setLoading(true);
    try {
      const g = await fetchGuild(guildId());
      if (g) {
        setGuild(g);
        const [memberList, msgList] = await Promise.all([
          fetchMembers(guildId()),
          fetchMessages(guildId()),
        ]);
        setMembers(memberList);
        setMessages(msgList);
        if (memberList.some((m) => m.userId === currentUser()?.id)) {
          await Promise.all([refreshNotes(), refreshTasks(), refreshGoals()]);
        }
      }
    } finally {
      setLoading(false);
    }

    enterSocketRoom();

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.guildId === guildId()) {
        addSocketMessage(msg);
        setMessages((prev) => {
          if (msg.userId === currentUser()?.id && pendingTempId()) {
            const tid = pendingTempId()!;
            setPendingTempId(null);
            return prev.map((m) => (m.id === tid ? { ...msg, reactions: msg.reactions || [] } : m));
          }
          return prev.some((m) => m.id === msg.id) ? prev : [...prev, msg];
        });
      }
    };

    const handleMemberJoined = async (data: { userId: string; username: string }) => {
      // Pull the authoritative member list so level/title/role are correct.
      await refreshMembers();
      // If this is the current user joining, refresh guild-only resources.
      if (data.userId === currentUser()?.id) {
        await Promise.all([refreshNotes(), refreshTasks(), refreshGoals()]);
        const g = await fetchGuild(guildId());
        if (g) setGuild(g);
      }
    };

    const handleMemberLeft = async (data: { userId: string }) => {
      setMembers((prev) => prev.filter((m) => m.userId !== data.userId));
      // Refresh guild so memberCount stays accurate.
      const g = await fetchGuild(guildId());
      if (g) setGuild(g);
      // If current user was kicked/left, clear guild-only data.
      if (data.userId === currentUser()?.id) {
        setNotes([]);
        setTasks([]);
        setGoals([]);
      }
    };

    const handleRoleChanged = (data: { userId: string; role: Role }) => {
      // A role change (incl. ownership transfer) can shift who can moderate — re-pull
      // the authoritative member list and guild (ownerId) rather than patch locally.
      refreshMembers();
      if (data.role === "owner") fetchGuild(guildId()).then((g) => g && setGuild(g));
    };

    const handleGuildUpdated = (data: { id: string; name: string; description: string }) => {
      setGuild((g) => g ? { ...g, name: data.name, description: data.description } : g);
    };

    const handleReactionUpdate = (data: { messageId: string; reactions: ChatMessage["reactions"] }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
      );
    };

    const handleSocketError = (err: { code: string; message: string }) => {
      addToast(err.message || "Chat connection error", "error");
    };

    on("guild:message", handleNewMessage);
    on("guild:user-joined", handleMemberJoined);
    on("guild:user-left", handleMemberLeft);
    on("guild:role-changed", handleRoleChanged);
    on("guild:updated", handleGuildUpdated);
    on("guild:message-reaction", handleReactionUpdate);
    on("error", handleSocketError);

    onCleanup(() => {
      // Only emit guild:leave for page-unmount cases (navigation to another
      // page). When the user explicitly left via handleLeave, the REST
      // endpoint already revoked membership and calling emit again would
      // broadcast a spurious guild:user-left for a non-member.
      if (!hasLeftManually) {
        emit("guild:leave", { guildId: guildId() });
      }
      off("guild:message", handleNewMessage);
      off("guild:user-joined", handleMemberJoined);
      off("guild:user-left", handleMemberLeft);
      off("guild:role-changed", handleRoleChanged);
      off("guild:updated", handleGuildUpdated);
      off("guild:message-reaction", handleReactionUpdate);
      off("error", handleSocketError);
    });
  });

  const [pendingTempId, setPendingTempId] = createSignal<string | null>(null);

  const handleSendMessage = async (content: string): Promise<boolean> => {
    const tempId = `temp-${Date.now()}`;
    const me = currentUser();
    if (!me) return false;
    const optimistic: ChatMessage = {
      id: tempId,
      guildId: guildId(),
      userId: me.id,
      user: { id: me.id, username: me.username, avatarUrl: me.avatarUrl || null },
      content,
      createdAt: new Date().toISOString(),
      reactions: [],
    };
    setMessages((prev) => [...prev, optimistic]);

    if (socket()?.connected) {
      setPendingTempId(tempId);
      emit("guild:send-message", { guildId: guildId(), content });
      setTimeout(() => {
        if (pendingTempId() === tempId) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setPendingTempId(null);
          addToast("Message may not have been delivered", "error");
        }
      }, 10000);
      return true;
    }

    const res = await authFetch(`/api/guilds/${guildId()}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      addToast("Failed to send message", "error");
      return false;
    }

    const json = await res.json();
    if (json.success && json.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...json.data, reactions: json.data.reactions || [] } : m))
      );
      return true;
    }

    setMessages((prev) => prev.filter((m) => m.id !== tempId));
    addToast(json.error?.message || "Failed to send message", "error");
    return false;
  };

  const handleReact = async (messageId: string, emoji: string) => {
    const me = currentUser();
    if (!me) return;

    // Capture the user's CURRENT reaction BEFORE the optimistic update.
    // Reading it afterwards would find the just-patched reaction and send
    // the wrong request (POST instead of DELETE or vice-versa).
    const currentReaction = messages()
      .find((m) => m.id === messageId)
      ?.reactions?.find((r) => r.userId === me.id);

    // If the user already has this exact emoji, toggle it off (DELETE).
    // Otherwise add/switch to the new emoji (POST).
    const shouldDelete = currentReaction?.emoji === emoji;

    // Optimistically patch local state
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ? [...m.reactions] : [];
        const existingIndex = reactions.findIndex((r) => r.userId === me.id);
        if (existingIndex >= 0) {
          if (shouldDelete) {
            reactions.splice(existingIndex, 1);
          } else {
            reactions[existingIndex] = { ...reactions[existingIndex], emoji };
          }
        } else if (!shouldDelete) {
          reactions.push({ emoji, userId: me.id, createdAt: new Date().toISOString() });
        }
        return { ...m, reactions };
      })
    );

    let res: Response;
    if (shouldDelete) {
      res = await authFetch(`/api/guilds/${guildId()}/messages/${messageId}/react`, { method: "DELETE" });
    } else {
      res = await authFetch(`/api/guilds/${guildId()}/messages/${messageId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    }

    if (!res.ok) {
      addToast("Failed to update reaction", "error");
      // Re-fetch messages to restore correct state
      setMessages(await fetchMessages(guildId()));
      return;
    }

    const json = await res.json();
    if (json.success && json.data?.reactions) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: json.data.reactions } : m))
      );
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      const code = inviteInput().trim() || undefined;
      const success = await joinGuild(guildId(), code);
      if (success) {
        addToast("Joined guild!", "success");
        await Promise.all([refreshMembers(), refreshNotes(), refreshTasks(), refreshGoals()]);
        const g = await fetchGuild(guildId());
        if (g) setGuild(g);
        enterSocketRoom();
      } else {
        addToast(guild()?.isPublic ? "Failed to join guild" : "Invalid or missing invite code", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      const success = await leaveGuild(guildId());
      if (success) {
        addToast("Left guild", "info");
        hasLeftManually = true;
        navigate("/guilds");
      } else {
        addToast("Failed to leave guild", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const confirmLeave = () => {
    if (isOwner()) {
      setShowLeaveConfirm(true);
    } else {
      void handleLeave();
    }
  };

  const handleRole = async (userId: string, role: Role, label: string) => {
    const ok = await updateMemberRole(guildId(), userId, role);
    if (ok) {
      addToast(label, "success");
      await refreshMembers();
      if (role === "owner") {
        const g = await fetchGuild(guildId());
        if (g) setGuild(g);
      }
    } else {
      addToast("Action failed", "error");
    }
  };

  const handleKick = async (userId: string) => {
    const ok = await kickMember(guildId(), userId);
    if (ok) {
      addToast("Member removed", "info");
      await refreshMembers();
    } else {
      addToast("Failed to remove member", "error");
    }
  };

  const handleMessage = async (userId: string) => {
    const groupId = await startDirectConversation(userId);
    if (groupId) {
      navigate(`/messages/${groupId}`);
    } else {
      addToast("Failed to start conversation", "error");
    }
  };

  const handleShareNote = async (noteId: string) => {
    const ok = await shareNoteToGuild(guildId(), noteId);
    addToast(ok ? "Scroll shared with the guild" : "Failed to share scroll", ok ? "success" : "error");
    if (ok) await refreshNotes();
  };

  const handleUnshareNote = async (noteId: string) => {
    const ok = await unshareNoteFromGuild(guildId(), noteId);
    addToast(ok ? "Scroll removed from guild" : "Failed to remove scroll", ok ? "info" : "error");
    if (ok) await refreshNotes();
  };

  const inviteLink = () => {
    const code = guild()?.inviteCode;
    if (!code || typeof window === "undefined") return "";
    return `${window.location.origin}/guilds/${guildId()}?code=${code}`;
  };

  const copyInvite = async () => {
    const link = inviteLink();
    if (!link || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Could not copy link", "error");
    }
  };

  const handleRegenerate = async () => {
    const code = await regenerateInvite(guildId());
    if (code) {
      setGuild((g) => (g ? { ...g, inviteCode: code } : g));
      addToast("Invite code regenerated", "success");
    } else {
      addToast("Failed to regenerate code", "error");
    }
  };

  return (
    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <Show
        when={!loading() && guild()}
        fallback={
          <div class="space-y-4 animate-pulse">
            <div class="h-8 w-48 bg-surface-border rounded" />
            <div class="h-4 w-96 bg-surface-border rounded" />
            <div class="h-96 bg-surface-border rounded-lg" />
          </div>
        }
      >
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="flex items-center gap-3">
            <div>
              <h1 class="text-2xl font-display font-bold text-ink-primary">
                {guild()!.name}
              </h1>
              <p class="text-sm text-ink-secondary mt-1">{guild()!.description}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span
              class={`text-xs px-2 py-1 rounded ${
                guild()!.isPublic ? "bg-success-bg text-success" : "bg-surface-border text-ink-secondary"
              }`}
            >
              {guild()!.isPublic ? "Public" : "Private"}
            </span>

            <Show when={!isMember()}>
              <Show when={!guild()!.isPublic}>
                <input
                  type="text"
                  placeholder="Invite code"
                  value={inviteInput()}
                  onInput={(e) => setInviteInput(e.currentTarget.value)}
                  class="w-28 rounded-md border border-surface-border px-2 py-1.5 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </Show>
              <button
                onClick={handleJoin}
                disabled={joining()}
                class="px-4 py-2 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {joining() ? "Joining..." : "Join Guild"}
              </button>
            </Show>

            <Show when={isMember()}>
              <button
                onClick={confirmLeave}
                disabled={leaving()}
                class="px-4 py-2 border border-surface-border text-ink-secondary rounded-md text-sm font-medium hover:border-error hover:text-error transition-colors disabled:opacity-50"
                title={isOwner() ? "Leave and transfer ownership to the oldest member" : "Leave guild"}
              >
                {leaving() ? "Leaving..." : isOwner() ? "Leave (transfer owner)" : "Leave"}
              </button>
            </Show>

          </div>
        </div>

        <div class="flex items-center gap-3 text-xs text-ink-secondary">
          <span class="inline-flex items-center gap-1">
            <span aria-hidden="true">👥</span>
            {guild()!.memberCount} members
          </span>
          <span>
            Created {new Date(guild()!.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Invite code panel — only visible to owner/admin (the API only returns it to them). */}
        <Show when={guild()!.inviteCode}>
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-surface-border bg-surface-elevated">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-ink-secondary mb-0.5">Invite code</p>
              <code class="text-sm font-mono text-accent">{guild()!.inviteCode}</code>
            </div>
            <div class="flex items-center gap-2">
              <button
                onClick={copyInvite}
                class="text-xs px-3 py-1.5 rounded-md border border-surface-border text-ink-secondary hover:border-accent hover:text-accent transition-colors"
              >
                {copied() ? "Copied!" : "Copy invite link"}
              </button>
              <button
                onClick={handleRegenerate}
                class="text-xs px-3 py-1.5 rounded-md border border-surface-border text-ink-secondary hover:border-accent hover:text-accent transition-colors"
                title="Generate a new code (invalidates the old one)"
              >
                Regenerate
              </button>
            </div>
          </div>
        </Show>

        <div class="flex gap-1 border-b border-surface-border overflow-x-auto">
            <button
              onClick={() => setTab("chat")}
              class={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                tab() === "chat"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span aria-hidden="true" class="mr-1.5">💬</span>
            Chat
          </button>
            <button
              onClick={() => setTab("scrolls")}
              class={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                tab() === "scrolls"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span aria-hidden="true" class="mr-1.5">📜</span>
            Scrolls
          </button>
            <button
              onClick={() => setTab("tasks")}
              class={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                tab() === "tasks"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span aria-hidden="true" class="mr-1.5">📋</span>
            Tasks
          </button>
            <button
              onClick={() => setTab("goals")}
              class={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                tab() === "goals"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span aria-hidden="true" class="mr-1.5">🎯</span>
            Goals
          </button>
            <button
              onClick={() => setTab("members")}
              class={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                tab() === "members"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span aria-hidden="true" class="mr-1.5">👥</span>
            Members
          </button>
        </div>

        <Show when={tab() === "chat"}>
          <Show
            when={isMember()}
            fallback={
              <div class="text-center py-12 text-ink-secondary">
                <p class="text-3xl mb-2">💬</p>
                <p class="text-sm">Join the guild to read and send messages.</p>
              </div>
            }
          >
            <GuildChat
              guildId={guildId()}
              messages={messages()}
              onSend={handleSendMessage}
              onReact={handleReact}
            />
          </Show>
        </Show>

        <Show when={tab() === "scrolls"}>
          <Show
            when={isMember()}
            fallback={
              <div class="text-center py-12 text-ink-secondary">
                <p class="text-3xl mb-2">📜</p>
                <p class="text-sm">Join the guild to view and share scrolls.</p>
              </div>
            }
          >
            <GuildNotes
              notes={notes()}
              currentUserId={currentUser()?.id}
              canModerate={canModerate()}
              onShare={handleShareNote}
              onUnshare={handleUnshareNote}
            />
          </Show>
        </Show>

        <Show when={tab() === "tasks"}>
          <Show
            when={isMember()}
            fallback={
              <div class="text-center py-12 text-ink-secondary">
                <p class="text-3xl mb-2">📋</p>
                <p class="text-sm">Join the guild to see assigned tasks.</p>
              </div>
            }
          >
            <GuildTasks
              guildId={guildId()}
              tasks={tasks()}
              members={members()}
              currentUserId={currentUser()?.id}
              canManage={canModerate()}
              onChanged={refreshTasks}
            />
          </Show>
        </Show>

        <Show when={tab() === "goals"}>
          <Show
            when={isMember()}
            fallback={
              <div class="text-center py-12 text-ink-secondary">
                <p class="text-3xl mb-2">🎯</p>
                <p class="text-sm">Join the guild to see and contribute to shared goals.</p>
              </div>
            }
          >
            <GuildGoals
              guildId={guildId()}
              goals={goals()}
              canManage={canModerate()}
              onChanged={refreshGoals}
            />
          </Show>
        </Show>

        <Show when={tab() === "members"}>
          <MemberList
            members={members()}
            currentUserId={currentUser()?.id}
            currentUserRole={myRole()}
            onPromote={(uid) => handleRole(uid, "admin", "Member promoted to admin")}
            onDemote={(uid) => handleRole(uid, "member", "Admin demoted to member")}
            onTransfer={(uid) => handleRole(uid, "owner", "Ownership transferred")}
            onKick={handleKick}
            onMessage={handleMessage}
          />
        </Show>
      </Show>

      <Show when={!loading() && !guild()}>
        <div class="text-center py-12">
          <Nelar state="worried" size={56} class="mx-auto mb-2" />
          <p class="text-ink-secondary">Guild not found</p>
        </div>
      </Show>

      <ConfirmModal
        open={showLeaveConfirm()}
        title="Leave Guild?"
        message={
          (guild()?.memberCount ?? members().length) <= 1
            ? "You are the last member. Leaving will delete this guild permanently."
            : "You are the guild owner. Leaving will transfer ownership to the longest-standing member."
        }
        variant="danger"
        confirmLabel={(guild()?.memberCount ?? members().length) <= 1 ? "Delete & Leave" : "Transfer & Leave"}
        cancelLabel="Cancel"
        onConfirm={handleLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}

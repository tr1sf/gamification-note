import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { useParams } from "@solidjs/router";
import { user, authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { fetchGuild, fetchMembers, fetchMessages, joinGuild, leaveGuild, addSocketMessage, updateMemberInList, removeMemberFromList, type Guild, type GuildMember, type ChatMessage } from "~/stores/guild";
import { useSocket } from "~/lib/socket/client";
import GuildChat from "~/components/guild/GuildChat";
import MemberList from "~/components/guild/MemberList";

export default function GuildDetailPage() {
  const params = useParams();
  const guildId = () => params.id as string;
  const { on, off, emit } = useSocket();

  const [guild, setGuild] = createSignal<Guild | null>(null);
  const [members, setMembers] = createSignal<GuildMember[]>([]);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [tab, setTab] = createSignal<"chat" | "members">("chat");
  const [joining, setJoining] = createSignal(false);
  const [leaving, setLeaving] = createSignal(false);

  const currentUser = () => user();
  const isMember = () => {
    const m = members();
    const u = currentUser();
    return m.some((member) => member.userId === u?.id);
  };
  const isOwner = () => guild()?.ownerId === currentUser()?.id;

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
      }
    } finally {
      setLoading(false);
    }

    emit("guild:join", { guildId: guildId() });

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.guildId === guildId()) {
        addSocketMessage(msg);
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleMemberJoined = (data: { userId: string; username: string }) => {
      setMembers((prev) => {
        if (prev.some((m) => m.userId === data.userId)) return prev;
        return [...prev, {
          id: `temp-${data.userId}`,
          userId: data.userId,
          guildId: guildId(),
          role: "member",
          user: { id: data.userId, username: data.username, avatarUrl: null, level: 1, title: "Novice Scribe" },
        } as GuildMember];
      });
    };

    const handleMemberLeft = (data: { userId: string; username: string }) => {
      setMembers((prev) => prev.filter((m) => m.userId !== data.userId));
    };

    on("guild:message", handleNewMessage);
    on("guild:user-joined", handleMemberJoined);
    on("guild:user-left", handleMemberLeft);

    onCleanup(() => {
      emit("guild:leave", { guildId: guildId() });
      off("guild:message", handleNewMessage);
      off("guild:user-joined", handleMemberJoined);
      off("guild:user-left", handleMemberLeft);
    });
  });

  const handleSendMessage = async (content: string) => {
    try {
      const res = await authFetch(
        `/api/guilds/${guildId()}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      const json = await res.json();
      if (!json.success) {
        addToast(json.error?.message || "Failed to send message", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      const success = await joinGuild(guildId());
      if (success) {
        addToast("Joined guild!", "success");
        const updatedMembers = await fetchMembers(guildId());
        setMembers(updatedMembers);
      } else {
        addToast("Failed to join guild", "error");
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
        setMembers([]);
        setMessages([]);
      } else {
        addToast("Failed to leave guild", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-4">
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
              <button
                onClick={handleJoin}
                disabled={joining()}
                class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {joining() ? "Joining..." : "Join Guild"}
              </button>
            </Show>

            <Show when={isMember() && !isOwner()}>
              <button
                onClick={handleLeave}
                disabled={leaving()}
                class="px-4 py-2 border border-surface-border text-ink-secondary rounded-md text-sm font-medium hover:border-error hover:text-error transition-colors disabled:opacity-50"
              >
                {leaving() ? "Leaving..." : "Leave"}
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

        <div class="flex gap-1 border-b border-surface-border">
          <button
            onClick={() => setTab("chat")}
            class={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab() === "chat"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span aria-hidden="true" class="mr-1.5">💬</span>
            Chat
          </button>
          <button
            onClick={() => setTab("members")}
            class={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab() === "members"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span aria-hidden="true" class="mr-1.5">👥</span>
            Members
          </button>
        </div>

        <Show when={isMember() || isOwner()}>
          <Show when={tab() === "chat"}>
            <GuildChat
              guildId={guildId()}
              messages={messages()}
              onSend={handleSendMessage}
            />
          </Show>
        </Show>

        <Show when={tab() === "members"}>
          <MemberList
            members={members()}
            currentUserId={currentUser()?.id}
          />
        </Show>
      </Show>

      <Show when={!loading() && !guild()}>
        <div class="text-center py-12">
          <p class="text-4xl mb-3">🏛️</p>
          <p class="text-ink-secondary">Guild not found</p>
        </div>
      </Show>
    </div>
  );
}

import { createSignal, For, onCleanup, onMount, Show, createEffect } from "solid-js";
import type { ChatMessage } from "~/stores/guild";
import { user } from "~/stores/auth";
import { timeAgo } from "~/lib/time-ago";
import CosmeticAvatar, { CosmeticName } from "~/components/cosmetics/CosmeticAvatar";
import Nelar from "~/components/mascot/Nelar";
import { t } from "~/lib/i18n";
import { useSocket } from "~/lib/socket/client";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "👏"];

function renderMentions(content: string) {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span class="text-accent font-medium">{part}</span>;
    }
    return <>{part}</>;
  });
}

interface GuildChatProps {
  guildId: string;
  messages: ChatMessage[];
  onSend: (content: string) => Promise<boolean> | boolean;
  onReact: (messageId: string, emoji: string) => Promise<void>;
}

export default function GuildChat(props: GuildChatProps) {
  const [newMessage, setNewMessage] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [typingUsers, setTypingUsers] = createSignal(new Map<string, number>());
  const { socket } = useSocket();
  let lastTypingEmit = 0;
  const handleInput = (e: InputEvent) => {
    const value = (e.target as HTMLInputElement).value;
    setNewMessage(value);
    const now = Date.now();
    if (now - lastTypingEmit > 2000) {
      socket()?.emit("guild:typing", { guildId: props.guildId });
      lastTypingEmit = now;
    }
  };

  onMount(() => {
    const s = socket();
    if (!s) return;
    const handler = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(userId, Date.now() + 3000); // Clear after 3 seconds
        return next;
      });
    };
    s.on("guild:typing", handler);
    onCleanup(() => s.off("guild:typing", handler));

    // Auto-clear typing indicators (inside onMount to avoid SSR leak)
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = new Map<string, number>();
        for (const [uid, expires] of prev) {
          if (expires > now) next.set(uid, expires);
        }
        return next;
      });
    }, 1000);
    onCleanup(() => clearInterval(interval));
  });

  let scrollContainer: HTMLDivElement | undefined;
  // Track whether the user is near the bottom so we don't yank them back
  // down when older messages are prepended (pagination) or when they've
  // scrolled up to read history.
  let wasNearBottom = true;

  const scrollToBottom = () => {
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  };

  const onScroll = () => {
    if (!scrollContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    wasNearBottom = scrollHeight - scrollTop - clientHeight < 60;
  };

  createEffect(() => {
    // Reading .length tracks the messages array; only scroll if the user
    // was already pinned to the bottom (otherwise preserve their reading
    // position when history is prepended).
    void props.messages.length;
    if (wasNearBottom) scrollToBottom();
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const content = newMessage().trim();
    if (!content || sending()) return;
    setSending(true);
    try {
      const ok = await props.onSend(content);
      if (ok) setNewMessage("");
    } finally {
      setSending(false);
    }
  };

  const timeAgoText = (dateStr: string) => timeAgo(dateStr);

  const currentUser = () => user();

  const reactionSummary = (msg: ChatMessage) => {
    const reactions = msg.reactions || [];
    const counts = new Map<string, number>();
    for (const r of reactions) {
      counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
  };

  const userReactedEmoji = (msg: ChatMessage) => {
    const myId = currentUser()?.id;
    return msg.reactions?.find((r) => r.userId === myId)?.emoji;
  };

  const toggleReaction = async (msg: ChatMessage, emoji: string) => {
    await props.onReact(msg.id, emoji);
  };

  return (
    <div class="flex flex-col h-[40vh] sm:h-[60vh] rounded-lg border border-surface-border bg-surface">
      <div
        ref={scrollContainer}
        onScroll={onScroll}
        class="flex-1 overflow-y-auto p-4 space-y-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        <Show
          when={props.messages.length > 0}
          fallback={
            <div class="text-center py-12 text-ink-secondary">
              <Nelar state="curious" size={56} class="mx-auto mb-2" />
              <p>{t("No messages yet. Be the first to say something!")}</p>
            </div>
          }
        >
          <For each={props.messages}>
            {(msg) => (
              <Show
                when={msg.type !== "system"}
                fallback={
                  <div class="flex justify-center">
                    <span class="text-xs text-ink-secondary bg-surface-elevated px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                }
              >
                <div
                  class={`flex gap-2.5 ${
                    msg.userId === currentUser()?.id ? "flex-row-reverse" : ""
                  }`}
                >
                  <CosmeticAvatar
                    username={msg.user.username}
                    avatarUrl={msg.user.avatarUrl ?? null}
                    equipped={msg.user.equipped}
                    size="sm"
                  />
                  <div
                    class={`max-w-[75%] ${
                      msg.userId === currentUser()?.id ? "items-end" : "items-start"
                    }`}
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <CosmeticName
                        username={msg.user.username}
                        equipped={msg.user.equipped}
                        class="text-xs font-medium"
                      />
                      <span class="text-xs text-ink-secondary">
                        {timeAgoText(msg.createdAt)}
                      </span>
                    </div>
                    <div
                      class={`px-3 py-2 rounded-lg text-sm ${
                        msg.userId === currentUser()?.id
                          ? "bg-accent/10 text-ink-primary"
                          : "bg-surface-elevated text-ink-primary"
                      }`}
                    >
                      {renderMentions(msg.content)}
                    </div>
                    <div class="flex items-center gap-1 mt-1 flex-wrap">
                      {/* Show every quick emoji as a direct toggle so the user
                          can see and pick reactions without an extra picker
                          popup. Active emoji (one's the user has reacted with)
                          is highlighted. */}
                      <For each={QUICK_EMOJIS}>
                        {(emoji) => {
                          const summary = () => reactionSummary(msg).find((r) => r.emoji === emoji);
                          const isMine = () => userReactedEmoji(msg) === emoji;
                          return (
                            <button
                              type="button"
                              onClick={() => toggleReaction(msg, emoji)}
                              class={`text-xs rounded px-1.5 py-0.5 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1 ${
                                isMine()
                                  ? "bg-accent/15 border-accent text-accent"
                                  : summary()
                                  ? "bg-surface-border border-transparent text-ink-secondary hover:text-accent hover:border-accent/30"
                                  : "bg-transparent border-transparent text-ink-secondary/60 hover:text-accent hover:border-accent/30"
                              }`}
                              aria-pressed={isMine()}
                              aria-label={`React with ${emoji}${summary() ? `, ${summary()!.count} total` : ""}${isMine() ? ", click to remove" : ""}`}
                              title={`${emoji}${summary() ? ` (${summary()!.count})` : ""}`}
                            >
                              <span aria-hidden="true">{emoji}</span>
                              <Show when={summary() && summary()!.count > 0}>
                                <span class="ml-0.5">{summary()!.count}</span>
                              </Show>
                            </button>
                          );
                        }}
                      </For>
                      {/* Existing reactions from OTHER users using emoji not in QUICK_EMOJIS */}
                      <Show when={reactionSummary(msg).some((r) => !QUICK_EMOJIS.includes(r.emoji))}>
                        <For each={reactionSummary(msg).filter((r) => !QUICK_EMOJIS.includes(r.emoji))}>
                          {(r) => {
                            const isMine = () => userReactedEmoji(msg) === r.emoji;
                            return (
                              <button
                                type="button"
                                onClick={() => toggleReaction(msg, r.emoji)}
                                class={`text-xs rounded px-1.5 py-0.5 border transition-colors ${
                                  isMine()
                                    ? "bg-accent/15 border-accent text-accent"
                                    : "bg-surface-border border-transparent text-ink-secondary"
                                } focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1`}
                                aria-pressed={isMine()}
                                aria-label={`${r.emoji} reaction, ${r.count} total`}
                              >
                                {r.emoji} {r.count}
                              </button>
                            );
                          }}
                        </For>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>

      <form
        onSubmit={handleSubmit}
        class="border-t border-surface-border p-2 sm:p-3 flex gap-1.5 sm:gap-2 sticky bottom-0 bg-surface"
      >
        <label for="chat-input" class="sr-only">{t("Message")}</label>
        <input
          id="chat-input"
          type="text"
          value={newMessage()}
          disabled={sending()}
          onInput={handleInput}
          placeholder={t("Type a message...")}
          class="flex-1 rounded-md border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          maxLength={2000}
        />
        <button
          type="button"
          disabled={sending()}
          onClick={() => setNewMessage((prev) => prev + "@")}
          class="px-3 py-2 border border-surface-border rounded-md text-xs text-ink-secondary hover:text-accent hover:border-accent transition-colors shrink-0 disabled:opacity-50"
          title="Mention a member"
        >
          @
        </button>
        <button
          type="submit"
          disabled={!newMessage().trim() || sending()}
          class="px-4 py-2 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {sending() ? t("Sending...") : t("Send")}
        </button>
      </form>
      <Show when={typingUsers().size > 0}>
        <div class="text-xs text-ink-secondary px-2 py-1">
          {Array.from(typingUsers().keys()).length === 1
            ? "Someone is typing..."
            : `${typingUsers().size} people are typing...`}
        </div>
      </Show>
    </div>
  );
}

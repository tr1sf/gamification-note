import { createSignal, For, Show, createEffect } from "solid-js";
import type { ChatMessage } from "~/stores/guild";
import { user } from "~/stores/auth";
import { timeAgo } from "~/lib/time-ago";

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
  let scrollContainer: HTMLDivElement | undefined;

  const scrollToBottom = () => {
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  };

  createEffect(() => {
    props.messages;
    scrollToBottom();
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

  const toggleReaction = async (msg: ChatMessage) => {
    const existing = userReactedEmoji(msg);
    await props.onReact(msg.id, existing || "👍");
  };

  return (
    <div class="flex flex-col h-[40vh] sm:h-[60vh] rounded-lg border border-surface-border bg-surface">
      <div
        ref={scrollContainer}
        class="flex-1 overflow-y-auto p-4 space-y-3"
      >
        <Show
          when={props.messages.length > 0}
          fallback={
            <div class="text-center py-12 text-ink-secondary">
              <p class="text-4xl mb-3">💬</p>
              <p>No messages yet. Be the first to say something!</p>
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
                  <div
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold shrink-0"
                    aria-label={msg.user.username}
                  >
                    {msg.user.username.charAt(0).toUpperCase()}
                  </div>
                  <div
                    class={`max-w-[75%] ${
                      msg.userId === currentUser()?.id ? "items-end" : "items-start"
                    }`}
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs font-medium text-ink-primary">
                        {msg.user.username}
                      </span>
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
                    <div class="flex items-center gap-1 mt-1">
                      <Show when={reactionSummary(msg).length > 0}>
                        <For each={reactionSummary(msg)}>
                          {(r) => (
                            <span
                              class={`text-xs rounded px-1.5 py-0.5 border ${
                                userReactedEmoji(msg) === r.emoji
                                  ? "bg-accent/15 border-accent text-accent"
                                  : "bg-surface-border border-transparent text-ink-secondary"
                              }`}
                            >
                              {r.emoji} {r.count}
                            </span>
                          )}
                        </For>
                      </Show>
                      <button
                        type="button"
                        onClick={() => toggleReaction(msg)}
                        class={`text-xs rounded px-1.5 py-0.5 border transition-colors ${
                          userReactedEmoji(msg)
                            ? "bg-accent/15 border-accent text-accent hover:bg-accent/25"
                            : "bg-surface-border border-transparent text-ink-secondary hover:text-accent hover:border-accent/30"
                        }`}
                        title={userReactedEmoji(msg) ? "Remove reaction" : "React with 👍"}
                      >
                        {userReactedEmoji(msg) ? userReactedEmoji(msg) : "👍"}
                      </button>
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
        <label for="chat-input" class="sr-only">Message</label>
        <input
          id="chat-input"
          type="text"
          value={newMessage()}
          disabled={sending()}
          onInput={(e) => setNewMessage(e.currentTarget.value)}
          placeholder="Type a message..."
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
          {sending() ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}

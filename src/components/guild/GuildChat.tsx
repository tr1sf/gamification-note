import { createSignal, For, Show, createEffect } from "solid-js";
import type { ChatMessage } from "~/stores/guild";
import { user } from "~/stores/auth";
import { timeAgo } from "~/lib/time-ago";

interface GuildChatProps {
  guildId: string;
  messages: ChatMessage[];
  onSend: (content: string) => void;
}

export default function GuildChat(props: GuildChatProps) {
  const [newMessage, setNewMessage] = createSignal("");
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

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const content = newMessage().trim();
    if (!content) return;
    props.onSend(content);
    setNewMessage("");
  };

  const timeAgoText = (dateStr: string) => timeAgo(dateStr);

  const currentUser = () => user();

  return (
    <div class="flex flex-col h-[60vh] rounded-lg border border-surface-border bg-surface">
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
                    class="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold shrink-0"
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
                      {msg.content}
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
        class="border-t border-surface-border p-3 flex gap-2"
      >
        <label for="chat-input" class="sr-only">Message</label>
        <input
          id="chat-input"
          type="text"
          value={newMessage()}
          onInput={(e) => setNewMessage(e.currentTarget.value)}
          placeholder="Type a message..."
          class="flex-1 rounded-md border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!newMessage().trim()}
          class="px-4 py-2 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}

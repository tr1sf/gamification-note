import { Show, For, onMount } from "solid-js";
import { A } from "@solidjs/router";
import { conversations, fetchConversations } from "~/stores/dm";

export default function MessagesPage() {
  onMount(() => {
    fetchConversations();
  });

  return (
    <div class="max-w-2xl mx-auto p-4">
      <h1 class="text-2xl font-bold text-ink-primary mb-4">Messages</h1>

      <Show when={conversations().length === 0}>
        <div class="text-center py-12 text-ink-secondary">
          <p>No conversations yet.</p>
          <p class="text-sm mt-2">Start a conversation from a guild member's profile.</p>
        </div>
      </Show>

      <For each={conversations()}>
        {(conv) => (
          <A
            href={`/messages/${conv.id}`}
            class="block p-3 border border-surface-border rounded-lg mb-2 hover:bg-surface-hover transition-colors"
          >
            <div class="flex items-center gap-3">
              {/* Avatar or group icon */}
              <div class="w-10 h-10 rounded-full bg-surface-border flex items-center justify-center text-ink-secondary">
                {conv.type === "group" ? "👥" : "💬"}
              </div>

              <div class="flex-1 min-w-0">
                <div class="font-medium text-ink-primary truncate">
                  {conv.name || conv.members.map((m) => m.username).join(", ")}
                </div>
                <Show when={conv.lastMessage}>
                  <div class="text-sm text-ink-secondary truncate">
                    {conv.lastMessage!.content}
                  </div>
                </Show>
              </div>
            </div>
          </A>
        )}
      </For>
    </div>
  );
}

import { Show, For, onMount, createSignal, onCleanup } from "solid-js";
import { useParams } from "@solidjs/router";
import { dmMessages, fetchDMMessages, sendDM, addSocketDMMessage } from "~/stores/dm";
import { useSocket } from "~/lib/socket/client";
import { user } from "~/stores/auth";

export default function DMChatPage() {
  const params = useParams<{ id: string }>();
  const [input, setInput] = createSignal("");
  const [typing, setTyping] = createSignal(false);
  const { socket, emit, on, off } = useSocket();
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    fetchDMMessages(params.id);
    const s = socket();
    if (s) {
      emit("dm:join", { groupId: params.id });
      on("dm:message", (msg: any) => {
        if (msg.groupId === params.id) {
          addSocketDMMessage(msg);
        }
      });
      on("dm:typing", ({ userId }: { userId: string }) => {
        if (userId !== user()?.id) {
          setTyping(true);
          if (typingTimeout) clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => setTyping(false), 3000);
        }
      });
    }
  });

  onCleanup(() => {
    emit("dm:leave", { groupId: params.id });
    off("dm:message", () => {});
    off("dm:typing", () => {});
    if (typingTimeout) clearTimeout(typingTimeout);
  });

  let lastTypingEmit = 0;
  const handleInput = (e: InputEvent) => {
    const target = e.currentTarget;
    if (target) {
      setInput((target as HTMLInputElement).value);
      const now = Date.now();
      if (now - lastTypingEmit > 2000) {
        emit("dm:typing", { groupId: params.id });
        lastTypingEmit = now;
      }
    }
  };

  const handleSend = async () => {
    const content = input().trim();
    if (!content) return;
    await sendDM(params.id, content);
    setInput("");
  };

  return (
    <div class="flex flex-col h-[calc(100vh-4rem)]">
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <For each={dmMessages()}>
          {(msg) => (
            <div class={`flex ${msg.senderId === user()?.id ? "justify-end" : "justify-start"}`}>
              <div class={`max-w-[70%] p-2 rounded-lg ${
                msg.senderId === user()?.id
                  ? "bg-accent text-white"
                  : "bg-surface-border text-ink-primary"
              }`}>
                <Show when={msg.senderId !== user()?.id && msg.sender}>
                  <div class="text-xs font-medium mb-1 opacity-70">
                    {msg.sender!.username}
                  </div>
                </Show>
                <div>{msg.content}</div>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="border-t border-surface-border p-2">
        <Show when={typing()}>
          <div class="text-xs text-ink-secondary px-2 py-1">Someone is typing...</div>
        </Show>
        <div class="flex gap-2">
          <input
            type="text"
            value={input()}
            onInput={handleInput}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            class="flex-1 px-3 py-2 bg-surface border border-surface-border rounded-lg text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Type a message..."
          />
          <button
            onClick={handleSend}
            class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

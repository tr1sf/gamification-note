import { For, Show } from "solid-js";
import { uiStore, dismissToast } from "~/stores/ui";

const ToastIcons: Record<string, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

export function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-50 space-y-2 max-w-sm" role="status" aria-live="polite">
      <For each={uiStore.toasts}>
        {(toast) => (
          <div
            class={`pl-3 pr-4 py-2.5 rounded-lg text-sm text-white flex items-center gap-2.5 bg-surface-overlay/90 backdrop-blur-sm border border-white/10 border-l-4 ${toast.type === "success" ? "border-l-success" : toast.type === "error" ? "border-l-error" : "border-l-accent"}`}
            style={`animation: fade-up 0.25s ease-out; box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);`}
            role="alert"
          >
            <span class="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-white/20" aria-hidden="true">
              {ToastIcons[toast.type]}
            </span>
            <span class="flex-1 font-medium">{toast.message}</span>
            <Show when={toast.action}>
              <button
                class="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-white/15 hover:bg-white/25 transition-colors"
                onClick={() => {
                  toast.action?.onClick();
                  dismissToast(toast.id);
                }}
              >
                {toast.action?.label}
              </button>
            </Show>
            <button
              class="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
      </For>
    </div>
  );
}

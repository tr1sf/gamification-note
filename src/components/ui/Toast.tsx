import { Show, For } from "solid-js";
import { uiStore, dismissToast } from "~/stores/ui";

export function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
      <For each={uiStore.toasts}>
        {(toast) => (
          <div
            class={`px-4 py-2 rounded-md shadow-lg text-sm text-white flex items-center gap-2 ${
              toast.type === "success" ? "bg-success" : toast.type === "error" ? "bg-error" : "bg-accent"
            }`}
            style="animation: slide-in 0.3s ease-out"
            role="alert"
          >
            <span>{toast.message}</span>
            <button
              class="ml-2 text-white/70 hover:text-white shrink-0"
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

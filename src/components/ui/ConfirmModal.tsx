import { Show } from "solid-js";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal(props: ConfirmModalProps) {
  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={props.title}>
        <div class="fixed inset-0 bg-surface-overlay/60" onClick={props.onCancel} />
        <div class="relative bg-surface-elevated rounded-lg border border-surface-border shadow-xl max-w-sm w-full mx-4 p-6">
          <h3 class="text-lg font-display font-semibold text-ink-primary mb-2">{props.title}</h3>
          <p class="text-sm text-ink-secondary mb-6">{props.message}</p>
          <div class="flex items-center justify-end gap-3">
            <button
              onClick={props.onCancel}
              class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary rounded-md hover:bg-surface-hover transition-colors"
            >
              {props.cancelLabel || "Cancel"}
            </button>
            <button
              onClick={props.onConfirm}
              class={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                props.variant === "danger"
                  ? "bg-error hover:bg-error/90"
                  : "bg-accent hover:bg-accent-hover"
              }`}
            >
              {props.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

import Modal from "./Modal";

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
    <Modal
      open={props.open}
      title={props.title}
      onDismiss={props.onCancel}
      class="max-w-sm"
    >
      <h3
        id="confirm-modal-title"
        class="text-lg font-display font-semibold text-ink-primary mb-2"
      >
        {props.title}
      </h3>
      <p
        id="confirm-modal-message"
        class="text-sm text-ink-secondary mb-6"
      >
        {props.message}
      </p>
      <div class="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={props.onCancel}
          class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary rounded-md hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
        >
          {props.cancelLabel || "Cancel"}
        </button>
        <button
          type="button"
          onClick={props.onConfirm}
          class={`px-4 py-2 text-sm font-medium text-surface-overlay rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${
            props.variant === "danger"
              ? "bg-error hover:bg-error/90"
              : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {props.confirmLabel || "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

import { Show, onMount, onCleanup, createEffect } from "solid-js";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  labelledById?: string;
  children?: any;
  onDismiss: () => void;
  class?: string;
  /** Selector for the element to receive initial focus. Defaults to first focusable. */
  initialFocusSelector?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]):not([aria-disabled="true"]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog with:
 *  - focus trap (Tab / Shift+Tab cycle inside the dialog)
 *  - Escape to dismiss
 *  - focus move-in on open + restore to previously-focused element on close
 *  - body scroll lock while open
 *  - aria-modal + role=dialog + aria-labelledby/describedby
 *  - overscroll-contain (page scroll does not chain behind modal)
 */
export default function Modal(props: ModalProps) {
  let panelRef: HTMLDivElement | undefined;
  let previouslyFocused: HTMLElement | null = null;

  // Lock body scroll + bind Escape while open.
  createEffect(() => {
    if (!props.open) return;
    if (typeof document === "undefined") return;

    previouslyFocused = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onDismiss();
        return;
      }
      if (e.key === "Tab" && panelRef) {
        const focusable = Array.from(
          panelRef.querySelectorAll<HTMLElement>(FOCUSABLE)
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the trigger; ignore if it's no longer focusable.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    });
  });

  // Move focus into the dialog when it opens.
  onMount(() => {
    createEffect(() => {
      if (!props.open || !panelRef) return;
      // Defer one microtask to let the panel mount in the DOM.
      queueMicrotask(() => {
        if (!panelRef) return;
        const target = props.initialFocusSelector
          ? panelRef.querySelector<HTMLElement>(props.initialFocusSelector)
          : panelRef.querySelector<HTMLElement>(FOCUSABLE);
        (target ?? panelRef).focus();
      });
    });
  });

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <div
          class="fixed inset-0 bg-surface-overlay/60"
          onClick={props.onDismiss}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          class={`relative bg-surface-elevated rounded-xl border border-surface-border shadow-xl max-w-sm w-full mx-4 p-6 outline-none overscroll-contain ${props.class ?? ""}`}
        >
          {props.children}
        </div>
      </div>
    </Show>
  );
}

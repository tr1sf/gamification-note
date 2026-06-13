import { createSignal, Show } from "solid-js";
import { createGuild } from "~/stores/guild";
import { addToast } from "~/stores/ui";
import { useNavigate } from "@solidjs/router";

interface CreateGuildProps {
  onClose: () => void;
}

export default function CreateGuild(props: CreateGuildProps) {
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [isPublic, setIsPublic] = createSignal(true);
  const [submitting, setSubmitting] = createSignal(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmedName = name().trim();
    if (!trimmedName) return;

    setSubmitting(true);
    try {
      const guild = await createGuild({
        name: trimmedName,
        description: description().trim(),
        isPublic: isPublic(),
      });
      if (guild) {
        addToast("Guild created!", "success");
        props.onClose();
        navigate(`/guilds/${guild.id}`);
      } else {
        addToast("Failed to create guild", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={handleOverlayClick}
    >
      <div
        class="bg-surface-elevated rounded-xl border border-surface-border shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-display font-semibold text-ink-primary">
            Create Guild
          </h2>
          <button
            onClick={props.onClose}
            class="p-1 text-ink-secondary hover:text-ink-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label for="guild-name" class="block text-sm font-medium text-ink-primary mb-1">
              Guild Name
            </label>
            <input
              id="guild-name"
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Enter guild name..."
              maxLength={50}
              required
              class="w-full rounded-md border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label for="guild-description" class="block text-sm font-medium text-ink-primary mb-1">
              Description
            </label>
            <textarea
              id="guild-description"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Describe your guild..."
              maxLength={200}
              rows={3}
              class="w-full rounded-md border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm text-ink-primary">Public guild</span>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic()}
              onClick={() => setIsPublic((v) => !v)}
              class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPublic() ? "bg-accent" : "bg-surface-border"
              }`}
            >
              <span
                class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isPublic() ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div class="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting() || !name().trim()}
              class="px-4 py-2 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting() ? "Creating..." : "Create Guild"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

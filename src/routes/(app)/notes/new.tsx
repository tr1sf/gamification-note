import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast, showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";

export default function NewNotePage() {
  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [category, setCategory] = createSignal("");
  const [isPublic, setIsPublic] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const navigate = useNavigate();

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!title().trim() || !content().trim()) {
      addToast("Title and content are required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title(),
          content: content(),
          category: category() || undefined,
          isPublic: isPublic(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast("Scroll inscribed!", "success");
        if (json.data?.gamification) {
          applyReward(json.data.gamification);
          showReward({
            xp: json.data.gamification.xpGained,
            coins: json.data.gamification.coinsGained,
            leveledUp: json.data.gamification.leveledUp,
            newLevel: json.data.gamification.newLevel,
            newTitle: json.data.gamification.newTitle,
          });
          if (json.data.gamification.unlockedAchievements?.length > 0) {
            json.data.gamification.unlockedAchievements.forEach(
              (ach: { id: string; title: string }) => {
                showReward({ achievement: ach.title });
              }
            );
          }
        }
        navigate(`/notes/${json.data.id}`);
      } else {
        addToast(json.error?.message || "Failed to create scroll", "error");
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") {
        addToast("Session expired. Please sign in again.", "error");
        navigate("/login");
      } else {
        addToast("Network error. Your scroll was not saved.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="max-w-3xl mx-auto p-6">
      <h1 class="text-2xl font-display font-bold text-ink-primary mb-6">New Scroll</h1>
      <form onSubmit={handleCreate} class="space-y-4" novalidate>
        <div>
          <label for="note-title" class="sr-only">Title</label>
          <input
            id="note-title"
            type="text"
            placeholder="Scroll title..."
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            class="w-full text-2xl font-display font-bold border-0 border-b-2 border-surface-border px-0 py-2 text-ink-primary bg-transparent focus:outline-none focus:border-accent placeholder:text-ink-secondary/30"
            autofocus
          />
        </div>
        <div>
          <div class="flex items-center gap-3 mb-2">
            <label for="note-category" class="sr-only">Category</label>
            <input
              id="note-category"
              type="text"
              placeholder="Category (optional)"
              value={category()}
              onInput={(e) => setCategory(e.currentTarget.value)}
              class="flex-1 text-sm border border-surface-border rounded px-2 py-1 bg-surface text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <label class="flex items-center gap-1.5 text-sm text-ink-secondary cursor-pointer">
              <input type="checkbox" checked={isPublic()} onChange={(e) => setIsPublic(e.currentTarget.checked)} class="rounded" />
              Public
            </label>
          </div>
          <label for="note-content" class="sr-only">Content</label>
          <textarea
            id="note-content"
            placeholder="Begin your scroll here... (Markdown supported)"
            value={content()}
            onInput={(e) => setContent(e.currentTarget.value)}
            rows={20}
            class="w-full rounded-md border border-surface-border px-3 py-2 text-ink-primary bg-surface font-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y min-h-[300px]"
          />
        </div>
        <div class="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving() || !title().trim() || !content().trim()}
            class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving() ? "Inscribing..." : "Inscribe Scroll"}
          </button>
          <button type="button" onClick={() => navigate("/notes")} class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

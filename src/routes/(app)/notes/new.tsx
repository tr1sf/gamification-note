import { createSignal, createMemo, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast, showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";
import { renderMarkdown } from "~/lib/markdown";

type ViewMode = "edit" | "split" | "preview";

export default function NewNotePage() {
  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [category, setCategory] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const [isPublic, setIsPublic] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>("edit");
  const navigate = useNavigate();

  let textareaRef!: HTMLTextAreaElement;

  // ── Live stats ───────────────────────────────────────────────
  const wordCount = createMemo(() => {
    const t = content().trim();
    return t ? t.split(/\s+/).length : 0;
  });
  const charCount = createMemo(() => content().length);
  const readingTime = createMemo(() => Math.max(1, Math.ceil(wordCount() / 200)));
  const renderedHTML = createMemo(() => renderMarkdown(content()));

  // ── Tag helpers ──────────────────────────────────────────────
  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (t && !tags().includes(t) && tags().length < 10) setTags([...tags(), t]);
    setTagInput("");
  };
  const removeTag = (tag: string) => setTags(tags().filter((t) => t !== tag));
  const handleTagKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagInput().trim()) addTag(tagInput());
    }
  };

  // ── Toolbar: insert markdown at cursor ───────────────────────
  const insertMarkdown = (prefix: string, suffix = "") => {
    const ta = textareaRef;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = content().slice(0, start);
    const selected = content().slice(start, end);
    const after = content().slice(end);
    setContent(before + prefix + selected + suffix + after);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + prefix.length;
      ta.selectionStart = suffix ? newPos : newPos + selected.length;
      ta.selectionEnd = suffix ? newPos + selected.length : newPos + selected.length;
    });
  };

  const toolbar = [
    { label: "B", title: "Bold",       action: () => insertMarkdown("**", "**"), extra: "font-bold" },
    { label: "I", title: "Italic",     action: () => insertMarkdown("*", "*"),   extra: "italic" },
    { label: "H", title: "Heading",    action: () => insertMarkdown("## "),      extra: "font-bold text-xs" },
    { label: "•", title: "List",       action: () => insertMarkdown("- ") },
    { label: "<>", title: "Code",      action: () => insertMarkdown("`", "`"),   extra: "font-mono text-xs" },
    { label: '"',  title: "Quote",     action: () => insertMarkdown("> "),       extra: "font-serif text-base" },
    { label: "🔗", title: "Link",      action: () => { const ta = textareaRef; const s = ta ? content().slice(ta.selectionStart, ta.selectionEnd) || "text" : "text"; insertMarkdown(`[${s}](`, ")"); } },
    { label: "—",  title: "Divider",   action: () => insertMarkdown("\n---\n") },
  ];

  // ── Create note handler ──────────────────────────────────────
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
          tags: tags().length > 0 ? tags() : undefined,
          isPublic: isPublic(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast("Note created!", "success");
        const note = json.data.note;
        const g = json.data.gamification;
        if (g) {
          applyReward(g);
          showReward({
            xp: g.xpGained,
            coins: g.coinsGained,
            leveledUp: g.leveledUp,
            newLevel: g.newLevel,
            newTitle: g.newTitle,
          });
          if (g.unlockedAchievements?.length > 0) {
            g.unlockedAchievements.forEach((ach: { id: string; title: string }) => {
              showReward({ achievement: ach.title });
            });
          }
        }
        navigate(`/notes/${note.id}`);
      } else {
        addToast(json.error?.message || "Failed to create note", "error");
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") {
        addToast("Session expired. Please sign in again.", "error");
        navigate("/login");
      } else {
        addToast("Network error. Your note was not saved.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── View mode helpers ────────────────────────────────────────
  const modeLabels: Record<ViewMode, string> = { edit: "Edit", split: "Split", preview: "Preview" };

  return (
    <div class="max-w-5xl mx-auto p-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <h1 class="text-2xl font-display font-bold text-ink-primary mb-6">New Note</h1>

      <form onSubmit={handleCreate} class="space-y-4" novalidate>
        {/* ── Title ───────────────────────────────────────────── */}
        <div>
          <label for="note-title" class="sr-only">Title</label>
          <input
            id="note-title"
            type="text"
            placeholder="Note title..."
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && textareaRef) {
                e.preventDefault();
                textareaRef.focus();
              }
            }}
            class="w-full text-2xl font-display font-bold border-0 border-b-2 border-surface-border px-0 py-2 text-ink-primary bg-transparent focus:outline-none focus:border-accent placeholder:text-ink-secondary/30"
            autofocus
          />
        </div>

        {/* ── Category + Public toggle ────────────────────────── */}
        <div class="flex items-center gap-3">
          <label for="note-category" class="sr-only">Category</label>
          <input
            id="note-category"
            type="text"
            placeholder="Category (optional)"
            value={category()}
            onInput={(e) => setCategory(e.currentTarget.value)}
            class="flex-1 text-sm border border-surface-border rounded px-2 py-1 bg-surface text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <label class="flex items-center gap-1.5 text-sm text-ink-secondary cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={isPublic()} onChange={(e) => setIsPublic(e.currentTarget.checked)} class="rounded" />
            Public
          </label>
        </div>

        {/* ── Tags ────────────────────────────────────────────── */}
        <div>
          <label class="sr-only" for="note-tags">Tags</label>
          <div class="flex flex-wrap items-center gap-1.5 border border-surface-border rounded px-2 py-1.5 bg-surface min-h-[36px] focus-within:ring-1 focus-within:ring-accent transition-all">
            <For each={tags()}>
              {(tag) => (
                <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent border border-accent/20">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} class="hover:text-error transition-colors leading-none">&times;</button>
                </span>
              )}
            </For>
            <input
              id="note-tags"
              type="text"
              placeholder={tags().length === 0 ? "Add tags (press Enter)..." : ""}
              value={tagInput()}
              onInput={(e) => setTagInput(e.currentTarget.value)}
              onKeyDown={handleTagKeydown}
              onBlur={() => { if (tagInput().trim()) addTag(tagInput()); }}
              class="flex-1 min-w-[120px] text-sm bg-transparent text-ink-primary outline-none border-none px-1 py-0"
            />
          </div>
        </div>

        {/* ── View mode toggle ────────────────────────────────── */}
        <div class="flex items-center justify-between">
          <div class="flex items-center bg-surface-elevated border border-surface-border rounded-lg p-0.5 gap-0.5">
            {(["edit", "split", "preview"] as ViewMode[]).map((mode) => (
              <button
                type="button"
                onClick={() => setViewMode(mode)}
                class={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                  viewMode() === mode
                    ? "bg-accent text-white shadow-sm"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {modeLabels[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Editor + Preview pane ───────────────────────────── */}
        <div class={`${viewMode() === "split" ? "grid grid-cols-2 gap-4" : ""}`}>
          {/* Editor panel */}
          <Show when={viewMode() !== "preview"}>
            <div>
              {/* Formatting toolbar */}
              <div class="flex items-center gap-0.5 mb-1 flex-wrap">
                <For each={toolbar}>
                  {(btn) => (
                    <button
                      type="button"
                      title={btn.title}
                      onClick={btn.action}
                      class={`px-2 py-1 text-xs rounded hover:bg-surface-border text-ink-secondary hover:text-ink-primary transition-colors ${btn.extra ?? ""}`}
                    >
                      {btn.label}
                    </button>
                  )}
                </For>
              </div>
              <label for="note-content" class="sr-only">Content</label>
              <textarea
                id="note-content"
                ref={(el) => { textareaRef = el; }}
                placeholder="Begin writing... (Markdown supported)"
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
                rows={20}
                class="w-full rounded-md border border-surface-border px-3 py-2 text-ink-primary bg-surface font-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y min-h-[300px]"
              />
            </div>
          </Show>

          {/* Preview panel */}
          <Show when={viewMode() !== "edit"}>
            <div
              class={`rounded-md border border-surface-border bg-surface-elevated p-4 overflow-auto min-h-[300px] ${
                viewMode() === "preview" ? "" : ""
              }`}
            >
              <Show
                when={content().trim()}
                fallback={<p class="text-ink-secondary/40 italic text-sm">Preview will appear here...</p>}
              >
                <div class="prose max-w-none text-sm" innerHTML={renderedHTML()} />
              </Show>
            </div>
          </Show>
        </div>

        {/* ── Stats bar ───────────────────────────────────────── */}
        <div class="flex items-center gap-4 text-xs text-ink-secondary">
          <span>{wordCount()} words</span>
          <span class="text-ink-secondary/30 select-none">|</span>
          <span>{charCount()} characters</span>
          <span class="text-ink-secondary/30 select-none">|</span>
          <span>~{readingTime()} min read</span>
        </div>

        {/* ── Action buttons ──────────────────────────────────── */}
        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving() || !title().trim() || !content().trim()}
            class="px-5 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving() ? "Saving..." : "Create Note"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/notes")}
            class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

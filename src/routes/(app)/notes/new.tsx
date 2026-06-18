import { createSignal, createMemo, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast, showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";
import Breadcrumb from "~/components/ui/Breadcrumb";
import BlockEditor from "~/components/editor/BlockEditor";
import BlockRenderer from "~/components/editor/BlockRenderer";
import { createBlock, computeBlockWordCount, blocksToMarkdown, blocksToHtml, type Block } from "~/lib/blocks";

type ViewMode = "edit" | "split" | "preview";

export default function NewNotePage() {
  const [title, setTitle] = createSignal("");
  const [blocks, setBlocks] = createSignal<Block[]>([createBlock("text")]);
  const [category, setCategory] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const [isPublic, setIsPublic] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>("edit");
  const navigate = useNavigate();

  const wordCount = createMemo(() => computeBlockWordCount(blocks()));
  const charCount = createMemo(() =>
    blocks().reduce((c, b) => c + (b.type === "divider" ? 0 : b.content.length), 0)
  );
  const readingTime = createMemo(() => Math.max(1, Math.ceil(wordCount() / 200)));
  const renderedHTML = createMemo(() => blocksToHtml(blocks()));
  const markdownContent = createMemo(() => blocksToMarkdown(blocks()));

  const serializedContent = createMemo(() => JSON.stringify(blocks()));

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

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!title().trim() || blocks().length === 0) {
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
          content: serializedContent(),
          category: category() || undefined,
          tags: tags().length > 0 ? tags() : undefined,
          isPublic: isPublic(),
          wordCount: wordCount(),
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
            message: g.message,
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

  const handleExport = () => {
    const md = `# ${title()}\n\n${markdownContent()}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title().replace(/[^a-zA-Z0-9]/g, "_") || "note"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("Downloaded as Markdown", "success");
  };

  const modeLabels: Record<ViewMode, string> = { edit: "Edit", split: "Split", preview: "Preview" };

  return (
    <div class="max-w-5xl mx-auto p-4 sm:p-6">
      <Breadcrumb items={[
        { label: "Notes", href: "/notes", icon: "📜" },
        { label: "New Note" },
      ]} />
      <h1 class="text-2xl font-display font-bold text-ink-primary mb-6">New Note</h1>

      <form onSubmit={handleCreate} class="space-y-4" novalidate>
        <div>
          <label for="note-title" class="sr-only">Title</label>
          <input
            id="note-title"
            type="text"
            placeholder="Note title..."
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            class="w-full text-2xl font-display font-bold border-0 border-b-2 border-surface-border px-0 py-2 text-ink-primary bg-transparent focus:outline-none focus:border-accent placeholder:text-ink-secondary/30"
            autofocus
          />
        </div>

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

        <div class="flex items-center justify-between">
          <div class="flex items-center bg-surface-elevated border border-surface-border rounded-lg p-0.5 gap-0.5">
            {(["edit", "split", "preview"] as ViewMode[]).map((mode) => (
              <button
                type="button"
                onClick={() => setViewMode(mode)}
                class={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                  viewMode() === mode
                    ? "bg-accent text-surface-overlay shadow-sm"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {modeLabels[mode]}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleExport} class="px-3 py-1.5 text-xs border border-surface-border text-ink-secondary rounded-md hover:bg-surface-hover transition-colors">
            Export .md
          </button>
        </div>

        <div class={`${viewMode() === "split" ? "grid grid-cols-2 gap-4" : ""}`}>
          <Show when={viewMode() !== "preview"}>
            <div class="rounded-md border border-surface-border bg-surface p-3 focus-within:ring-1 focus-within:ring-accent transition-all min-h-[300px]">
              <BlockEditor blocks={blocks()} onBlocksChange={setBlocks} />
            </div>
          </Show>

          <Show when={viewMode() !== "edit"}>
            <div
              class={`rounded-md border border-surface-border bg-surface-elevated p-4 overflow-auto min-h-[300px] ${
                viewMode() === "preview" ? "" : ""
              }`}
            >
              <Show
                when={blocks().some(b => b.content.trim())}
                fallback={<p class="text-ink-secondary/40 italic text-sm">Preview will appear here...</p>}
              >
                <BlockRenderer blocks={blocks()} />
              </Show>
            </div>
          </Show>
        </div>

        <div class="flex items-center gap-4 text-xs text-ink-secondary">
          <span>{wordCount()} words</span>
          <span class="text-ink-secondary/30 select-none">|</span>
          <span>{charCount()} characters</span>
          <span class="text-ink-secondary/30 select-none">|</span>
          <span>~{readingTime()} min read</span>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving() || !title().trim() || blocks().length === 0 || !blocks().some(b => b.content.trim())}
            class="px-5 py-2 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
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

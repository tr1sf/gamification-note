import { createResource, createSignal, Show, Switch, Match, For } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { t } from "~/lib/i18n";
import { timeAgo } from "~/lib/time-ago";
import { renderMarkdown } from "~/lib/markdown";
import { isBlockContent, parseBlocks, markdownToBlocks, blocksToMarkdown, blocksToHtml, computeBlockWordCount, normalizeBlocks, type Block } from "~/lib/blocks";
import BlockEditor from "~/components/editor/BlockEditor";
import BlockRenderer from "~/components/editor/BlockRenderer";
import ConfirmModal from "~/components/ui/ConfirmModal";
import Breadcrumb from "~/components/ui/Breadcrumb";

interface Note {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  isPublic: boolean;
  wordCount: number;
  version: number;
  aiSummary: string | null;
  aiImageUrl?: string | null;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

async function fetchNote(id: string): Promise<Note> {
  if (typeof document === "undefined") throw new Error("SSR");
  const res = await authFetch(`/api/notes/${id}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Not found");
  return json.data;
}

export default function NoteDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = createSignal(false);
  const [duplicating, setDuplicating] = createSignal(false);
  const [editTitle, setEditTitle] = createSignal("");
  const [editContent, setEditContent] = createSignal("");
  const [editBlocks, setEditBlocks] = createSignal<Block[]>([]);
  const [editCategory, setEditCategory] = createSignal("");
  const [editTags, setEditTags] = createSignal<string[]>([]);
  const [editTagInput, setEditTagInput] = createSignal("");
  const [editIsPublic, setEditIsPublic] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [useBlockEditor, setUseBlockEditor] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [showExportMenu, setShowExportMenu] = createSignal(false);
  const [summarizing, setSummarizing] = createSignal(false);

  const [note, { refetch }] = createResource(() => params.id, fetchNote);

  const isBlockMode = (content?: string) => content ? isBlockContent(content) : false;

  const startEditing = (n: Note) => {
    setEditTitle(n.title);
    setEditContent(n.content);
    const isBlocks = isBlockContent(n.content);
    setUseBlockEditor(isBlocks);
    if (isBlocks) {
      setEditBlocks(normalizeBlocks(parseBlocks(n.content)));
    }
    setEditCategory(n.category ?? "");
    setEditTags([...n.tags]);
    setEditIsPublic(n.isPublic);
    setIsEditing(true);
  };

  const convertToBlocks = () => {
    setEditBlocks(normalizeBlocks(markdownToBlocks(editContent())));
    setUseBlockEditor(true);
  };

  const saveEdit = async () => {
    if (!note()) return;
    setSaving(true);
    try {
      const n = note()!;
      const useBlocks = useBlockEditor();
      const contentToSend = useBlocks ? JSON.stringify(editBlocks()) : editContent();
      const wc = useBlocks ? computeBlockWordCount(editBlocks()) : editContent().split(/\s+/).filter(Boolean).length;

      const res = await authFetch(`/api/notes/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle(),
          content: contentToSend,
          category: editCategory() || undefined,
          tags: editTags().length > 0 ? editTags() : undefined,
          isPublic: editIsPublic(),
          version: n.version,
          wordCount: wc,
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(t("Note updated!"), "success");
        setIsEditing(false);
        refetch();
      } else if (json.error?.code === "CONFLICT") {
        addToast(t("This note was modified elsewhere. Please refresh and try again."), "error");
        setIsEditing(false);
        refetch();
      } else {
        addToast(json.error?.message || t("Save failed"), "error");
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") {
        addToast(t("Session expired. Please sign in again."), "error");
        navigate("/login");
      } else {
        addToast(t("Network error. Changes not saved."), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    const n = note();
    if (!n) return;
    const useBlocks = useBlockEditor();
    const contentChanged = useBlocks
      ? JSON.stringify(editBlocks()) !== n.content
      : editContent() !== n.content;
    if (
      editTitle() !== n.title ||
      contentChanged ||
      editCategory() !== (n.category ?? "") ||
      JSON.stringify(editTags()) !== JSON.stringify(n.tags) ||
      editIsPublic() !== n.isPublic
    ) {
      setShowDiscardConfirm(true);
      return;
    }
    setIsEditing(false);
  };

  const addEditTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (t && !editTags().includes(t) && editTags().length < 10) setEditTags([...editTags(), t]);
    setEditTagInput("");
  };
  const removeEditTag = (tag: string) => setEditTags(editTags().filter((t) => t !== tag));
  const handleEditTagKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (editTagInput().trim()) addEditTag(editTagInput());
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const res = await authFetch(`/api/notes/${params.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        addToast(t("Note deleted"), "info", {
          duration: 7000,
          action: {
            label: t("Undo"),
            onClick: async () => {
              const restoreRes = await authFetch(`/api/notes/${params.id}/restore`, { method: "POST" });
              const restoreJson = await restoreRes.json();
              if (restoreJson.success) {
                addToast(t("Note restored!"), "success");
                navigate(`/notes/${params.id}`);
              } else {
                addToast(restoreJson.error?.message || t("Restore failed"), "error");
              }
            },
          },
        });
        navigate("/notes");
      } else {
        addToast(json.error?.message || t("Delete failed"), "error");
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") {
        addToast(t("Session expired"), "error");
        navigate("/login");
      } else {
        addToast(t("Network error"), "error");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await authFetch(`/api/notes/${params.id}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addToast(t("Note duplicated!"), "success");
        navigate(`/notes/${json.data.id}`);
      } else {
        addToast(json.error?.message || t("Duplicate failed"), "error");
      }
    } catch {
      addToast(t("Network error"), "error");
    } finally {
      setDuplicating(false);
    }
  };

  const handleExport = (format: "md" | "txt" | "html") => {
    const n = note();
    if (!n) return;
    const useBlocks = isBlockMode(n.content);
    let content: string;
    let type: string;
    let ext: string;
    if (format === "html") {
      content = useBlocks ? blocksToHtml(parseBlocks(n.content)) : renderMarkdown(n.content);
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${n.title}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#222}h1{font-size:2rem;margin-bottom:0.5rem}</style></head><body><h1>${n.title}</h1>${content}</body></html>`;
      type = "text/html";
      ext = "html";
    } else if (format === "txt") {
      content = useBlocks ? blocksToMarkdown(parseBlocks(n.content)) : n.content;
      content = `${n.title}\n\n${content}`.replace(/[#*_>`\[\]()]/g, "");
      type = "text/plain";
      ext = "txt";
    } else {
      content = useBlocks ? blocksToMarkdown(parseBlocks(n.content)) : n.content;
      content = `# ${n.title}\n\n${content}`;
      type = "text/markdown";
      ext = "md";
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${n.title.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`${t("Exported as")} ${ext.toUpperCase()}`, "success");
  };

  const handleSummarize = async () => {
    const n = note();
    if (!n) return;
    setSummarizing(true);
    try {
      const res = await authFetch(`/api/notes/${n.id}/summarize`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        addToast(t("AI summary generated!"), "success");
        refetch();
      } else {
        addToast(json.error?.message || t("Summary failed"), "error");
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") {
        addToast(t("Session expired"), "error");
        navigate("/login");
      } else {
        addToast(t("Network error"), "error");
      }
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div class="max-w-3xl mx-auto p-6">
      <Show when={!note.loading} fallback={<div class="animate-pulse text-ink-secondary">{t("Loading note...")}</div>}>
        <Show when={!note.error} fallback={
          <div class="text-center py-12">
            <p class="text-error mb-3">{note.error?.message}</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm">{t("Try again")}</button>
          </div>
        }>
          <Show when={note()}>
            {(n) => (
              <Switch>
                <Match when={!isEditing()}>
                  <article>
                    <Breadcrumb items={[
                      { label: t("Notes"), href: "/notes", icon: "📜" },
                      { label: n().title },
                    ]} />

                    <Show when={n().aiImageUrl}>
                      <img src={n().aiImageUrl ?? undefined} alt="" class="w-full h-48 object-cover rounded-lg mb-6" />
                    </Show>

                    <div class="flex items-start justify-between mb-6">
                      <div>
                        <h1 class="text-3xl font-display font-bold text-ink-primary">{n().title}</h1>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                          <span class="text-sm text-ink-secondary">{n().wordCount} {t("words")}</span>
                          {n().category && (
                            <span class="text-xs px-2 py-0.5 rounded border border-surface-border text-ink-secondary">{n().category}</span>
                          )}
                          {n().tags?.length > 0 && n().tags.map((tag) => (
                            <span class="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">{tag}</span>
                          ))}
                          {n().isPublic && (
                            <span class="text-xs px-2 py-0.5 rounded bg-success-bg text-success">{t("Public")}</span>
                          )}
                          <span class="text-xs text-ink-secondary/50">v{n().version}</span>
                        </div>
                        <div class="flex items-center gap-2 mt-1.5 text-xs text-ink-secondary/60">
                          <span>{t("Created")} {timeAgo(n().createdAt)}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{t("Updated")} {timeAgo(n().updatedAt)}</span>
                        </div>
                      </div>
                      <Show when={n().isOwner}>
                        <div class="flex items-center gap-2 flex-wrap">
                          <button onClick={handleDuplicate} disabled={duplicating()} class="px-3 py-1.5 text-sm border border-surface-border text-ink-secondary rounded-md hover:bg-surface-hover transition-colors disabled:opacity-50">{duplicating() ? t("Duplicating...") : t("Duplicate")}</button>
                          <div class="relative">
                            <button onClick={() => setShowExportMenu(!showExportMenu())} class="px-3 py-1.5 text-sm border border-surface-border text-ink-secondary rounded-md hover:bg-surface-hover transition-colors">{t("Export")} ▾</button>
                            <Show when={showExportMenu()}>
                              <div class="absolute right-0 mt-1 bg-surface-elevated border border-surface-border rounded-lg shadow-lg py-1 z-20 min-w-[120px]" onClick={() => setShowExportMenu(false)}>
                                <button onClick={() => handleExport("md")} class="block w-full text-left px-3 py-1.5 text-sm text-ink-primary hover:bg-surface-hover transition-colors">{t("Markdown (.md)")}</button>
                                <button onClick={() => handleExport("txt")} class="block w-full text-left px-3 py-1.5 text-sm text-ink-primary hover:bg-surface-hover transition-colors">{t("Plain text (.txt)")}</button>
                                <button onClick={() => handleExport("html")} class="block w-full text-left px-3 py-1.5 text-sm text-ink-primary hover:bg-surface-hover transition-colors">{t("HTML (.html)")}</button>
                              </div>
                            </Show>
                          </div>
                          <button onClick={() => startEditing(n())} class="px-3 py-1.5 text-sm bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors">{t("Edit")}</button>
                          <Show when={!n().aiSummary}>
                            <button onClick={handleSummarize} disabled={summarizing()} class="px-3 py-1.5 text-sm bg-accent text-surface-overlay rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50">{summarizing() ? t("Summarizing...") : `✨ ${t("Summarize")}`}</button>
                          </Show>
                          <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting()} class="px-3 py-1.5 text-sm text-error hover:bg-error-bg rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{deleting() ? t("Trashing...") : t("Trash")}</button>
                        </div>
                      </Show>
                    </div>

                    <Show when={n().isPublic}>
                      <div class="mt-4 flex items-center gap-2 p-3 bg-accent/5 border border-accent/15 rounded-lg">
                        <span class="text-sm text-ink-secondary">{t("Share link:")}</span>
                        <code class="flex-1 text-xs bg-surface border border-surface-border rounded px-2 py-1 text-ink-primary truncate select-all">{typeof window !== "undefined" ? `${window.location.origin}/share/${n().id}` : ""}</code>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/share/${n().id}`;
                            navigator.clipboard.writeText(url);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          class="shrink-0 px-3 py-1 text-xs bg-accent text-surface-overlay rounded-md hover:bg-accent-hover transition-colors"
                        >
                          {copied() ? t("Copied!") : t("Copy link")}
                        </button>
                      </div>
                    </Show>

                    <div class="mt-6">
                      <Show
                        when={isBlockMode(n().content)}
                        fallback={
                          <div class="prose max-w-none text-sm" innerHTML={renderMarkdown(n().content)} />
                        }
                      >
                        <BlockRenderer blocks={parseBlocks(n().content)} />
                      </Show>
                    </div>

                    <Show when={n().aiSummary}>
                      <div class="mt-8 p-4 bg-surface-elevated rounded-lg border border-surface-border">
                        <h3 class="text-sm font-medium text-ink-secondary mb-2">{t("AI Summary")}</h3>
                        <p class="text-sm text-ink-primary">{n().aiSummary}</p>
                      </div>
                    </Show>

                    {/* Quality Score Insights — generated by the gamification quality scorer */}
                    <Show when={n().isOwner}>
                      <QualityPanel noteId={n().id} />
                    </Show>

                    <div class="mt-6">
                      <A href="/notes" class="text-sm text-accent hover:underline">&larr; {t("Back to notes")}</A>
                    </div>
                  </article>
                </Match>

                <Match when={isEditing()}>
                  <div class="space-y-4">
                    <label for="edit-title" class="sr-only">Title</label>
                    <input
                      id="edit-title"
                      type="text"
                      value={editTitle()}
                      onInput={(e) => setEditTitle(e.currentTarget.value)}
                      class="w-full text-2xl font-display font-bold border-0 border-b-2 border-surface-border px-0 py-2 text-ink-primary bg-transparent focus:outline-none focus:border-accent"
                    />

                    <div class="flex items-center gap-3">
                      <label for="edit-category" class="sr-only">Category</label>
                      <input
                        id="edit-category"
                        type="text"
                        placeholder="Category (optional)"
                        value={editCategory()}
                        onInput={(e) => setEditCategory(e.currentTarget.value)}
                        class="flex-1 text-sm border border-surface-border rounded px-2 py-1 bg-surface text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <label class="flex items-center gap-1.5 text-sm text-ink-secondary cursor-pointer whitespace-nowrap">
                        <input type="checkbox" checked={editIsPublic()} onChange={(e) => setEditIsPublic(e.currentTarget.checked)} class="rounded" />
                        Public
                      </label>
                    </div>

                    <div>
                      <label class="sr-only" for="edit-tags-input">Tags</label>
                      <div class="flex flex-wrap items-center gap-1.5 border border-surface-border rounded px-2 py-1.5 bg-surface min-h-[36px] focus-within:ring-1 focus-within:ring-accent transition-all">
                        <For each={editTags()}>
                          {(tag) => (
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent border border-accent/20">
                              {tag}
                              <button type="button" onClick={() => removeEditTag(tag)} class="hover:text-error transition-colors leading-none">&times;</button>
                            </span>
                          )}
                        </For>
                        <input
                          id="edit-tags-input"
                          type="text"
                          placeholder={editTags().length === 0 ? "Add tags (press Enter)..." : ""}
                          value={editTagInput()}
                          onInput={(e) => setEditTagInput(e.currentTarget.value)}
                          onKeyDown={handleEditTagKeydown}
                          onBlur={() => { if (editTagInput().trim()) addEditTag(editTagInput()); }}
                          class="flex-1 min-w-[120px] text-sm bg-transparent text-ink-primary outline-none border-none px-1 py-0"
                        />
                      </div>
                    </div>

                    <Show
                      when={useBlockEditor()}
                      fallback={
                        <>
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-xs text-ink-secondary">Markdown mode</span>
                            <button type="button" onClick={convertToBlocks} class="text-xs text-accent hover:underline">Convert to Blocks</button>
                          </div>
                          <label for="edit-content" class="sr-only">Content</label>
                          <textarea
                            id="edit-content"
                            value={editContent()}
                            onInput={(e) => setEditContent(e.currentTarget.value)}
                            rows={25}
                            class="w-full rounded-md border border-surface-border px-3 py-2 text-ink-primary bg-surface font-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y min-h-[400px]"
                          />
                        </>
                      }
                    >
                      <div class="rounded-md border border-surface-border bg-surface p-3 focus-within:ring-1 focus-within:ring-accent transition-all min-h-[400px]">
                        <BlockEditor blocks={editBlocks()} onBlocksChange={setEditBlocks} />
                      </div>
                    </Show>

                    <div class="flex items-center gap-3">
                      <button onClick={saveEdit} disabled={saving()} class="px-4 py-2 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors">
                        {saving() ? "Saving..." : "Save Changes"}
                      </button>
                      <button onClick={cancelEdit} class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors">Cancel</button>
                    </div>
                  </div>
                </Match>
              </Switch>
            )}
          </Show>
        </Show>
      </Show>
      <ConfirmModal
        open={showDeleteConfirm()}
        title={t("Move to trash")}
        message={t("Are you sure you want to move this note to the trash?")}
        confirmLabel={t("Move to Trash")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmModal
        open={showDiscardConfirm()}
        title={t("Discard changes")}
        message={t("You have unsaved changes. Are you sure you want to discard them?")}
        confirmLabel={t("Discard")}
        variant="danger"
        onConfirm={() => { setShowDiscardConfirm(false); setIsEditing(false); }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}

// ── Quality Score Panel ──────────────────────────────────────────────────────
function QualityPanel(props: { noteId: string }) {
  const [quality] = createResource(async () => {
    const res = await authFetch(`/api/notes/${props.noteId}/quality`);
    const json = await res.json();
    return json.success ? json.data : null;
  });

  const tierColor = () => {
    const s = quality()?.score ?? 0;
    if (s >= 8) return "text-success";
    if (s >= 6) return "text-accent";
    if (s >= 4) return "text-coin";
    return "text-error";
  };

  const tierIcon = () => {
    const s = quality()?.score ?? 0;
    if (s >= 8) return "⭐";
    if (s >= 6) return "✨";
    if (s >= 4) return "📝";
    return "🔧";
  };

  return (
    <Show when={quality()}>
      {(q) => (
        <div class="mt-8 p-4 bg-surface-elevated rounded-lg border border-surface-border">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-medium text-ink-secondary flex items-center gap-1.5">
              <span aria-hidden="true">{tierIcon()}</span> Quality Score
            </h3>
            <span class={`text-lg font-bold ${tierColor()}`}>
              {q().score}<span class="text-sm text-ink-secondary">/{q().maxScore}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div class="h-2 bg-surface-border rounded-full overflow-hidden mb-3">
            <div
              class="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(q().score / q().maxScore) * 100}%`,
                background: q().score >= 8 ? "var(--color-success)" : q().score >= 6 ? "var(--color-accent)" : q().score >= 4 ? "var(--color-coin)" : "var(--color-error)",
              }}
            />
          </div>
          <p class={`text-xs font-medium ${tierColor()} mb-3`}>{q().tier}</p>

          {/* Breakdown chips */}
          <div class="flex flex-wrap gap-1.5 mb-3">
            <span class={`text-xs px-2 py-0.5 rounded ${q().breakdown.hasH1 ? "bg-success-bg text-success" : "bg-surface-border text-ink-tertiary"}`}>
              {q().breakdown.hasH1 ? "✓" : "✗"} Heading
            </span>
            <span class={`text-xs px-2 py-0.5 rounded ${q().breakdown.hasH2 ? "bg-success-bg text-success" : "bg-surface-border text-ink-tertiary"}`}>
              {q().breakdown.hasH2 ? "✓" : "✗"} Subheading
            </span>
            <span class={`text-xs px-2 py-0.5 rounded ${q().breakdown.hasList ? "bg-success-bg text-success" : "bg-surface-border text-ink-tertiary"}`}>
              {q().breakdown.hasList ? "✓" : "✗"} List
            </span>
            <span class={`text-xs px-2 py-0.5 rounded ${q().breakdown.hasCode ? "bg-success-bg text-success" : "bg-surface-border text-ink-tertiary"}`}>
              {q().breakdown.hasCode ? "✓" : "✗"} Code
            </span>
            <span class={`text-xs px-2 py-0.5 rounded ${q().breakdown.linkCount > 0 ? "bg-success-bg text-success" : "bg-surface-border text-ink-tertiary"}`}>
              {q().breakdown.linkCount > 0 ? "✓" : "✗"} Links ({q().breakdown.linkCount})
            </span>
            <span class={`text-xs px-2 py-0.5 rounded ${q().breakdown.tagCount > 0 ? "bg-success-bg text-success" : "bg-surface-border text-ink-tertiary"}`}>
              {q().breakdown.tagCount > 0 ? "✓" : "✗"} Tags ({q().breakdown.tagCount})
            </span>
            <span class={`text-xs px-2 py-0.5 rounded ${q().breakdown.hasCategory ? "bg-success-bg text-success" : "bg-surface-border text-ink-tertiary"}`}>
              {q().breakdown.hasCategory ? "✓" : "✗"} Category
            </span>
          </div>

          {/* Suggestions */}
          <Show when={q().suggestions.length > 0}>
            <div class="border-t border-surface-border pt-3">
              <p class="text-xs text-ink-tertiary mb-2">💡 Improve your score:</p>
              <ul class="space-y-1">
                <For each={q().suggestions}>
                  {(sug: any) => (
                    <li class="text-xs text-ink-secondary flex items-center gap-2">
                      <span class="text-accent font-mono">+{sug.points}</span>
                      <span>{sug.text}</span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}

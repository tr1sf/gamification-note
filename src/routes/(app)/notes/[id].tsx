import { createResource, createSignal, Show, Switch, Match, For } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { timeAgo } from "~/lib/time-ago";
import { renderMarkdown } from "~/lib/markdown";
import ConfirmModal from "~/components/ui/ConfirmModal";

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
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

async function fetchNote(id: string): Promise<Note> {
  if (typeof document === "undefined") throw new Error("SSR"); // wait for client
  const res = await authFetch(`/api/notes/${id}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Not found");
  return json.data;
}

export default function NoteDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = createSignal(false);
  const [editTitle, setEditTitle] = createSignal("");
  const [editContent, setEditContent] = createSignal("");
  const [editCategory, setEditCategory] = createSignal("");
  const [editTags, setEditTags] = createSignal<string[]>([]);
  const [editTagInput, setEditTagInput] = createSignal("");
  const [editIsPublic, setEditIsPublic] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = createSignal(false);

  const [note, { refetch }] = createResource(() => params.id, fetchNote);

  const startEditing = (n: Note) => {
    setEditTitle(n.title);
    setEditContent(n.content);
    setEditCategory(n.category ?? "");
    setEditTags([...n.tags]);
    setEditIsPublic(n.isPublic);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!note()) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/notes/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle(),
          content: editContent(),
          category: editCategory() || undefined,
          tags: editTags().length > 0 ? editTags() : undefined,
          isPublic: editIsPublic(),
          version: note()!.version,
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast("Note updated!", "success");
        setIsEditing(false);
        refetch();
      } else if (json.error?.code === "CONFLICT") {
        addToast("This note was modified elsewhere. Please refresh and try again.", "error");
        setIsEditing(false);
        refetch();
      } else {
        addToast(json.error?.message || "Save failed", "error");
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") {
        addToast("Session expired. Please sign in again.", "error");
        navigate("/login");
      } else {
        addToast("Network error. Changes not saved.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    const n = note();
    if (n && (
      editTitle() !== n.title ||
      editContent() !== n.content ||
      editCategory() !== (n.category ?? "") ||
      JSON.stringify(editTags()) !== JSON.stringify(n.tags) ||
      editIsPublic() !== n.isPublic
    )) {
      setShowDiscardConfirm(true);
      return;
    }
    setIsEditing(false);
  };

  // ── Tag helpers for edit mode ──────────────────────────────────
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
        addToast("Note moved to trash", "info");
        navigate("/notes");
      } else {
        addToast(json.error?.message || "Delete failed", "error");
      }
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED") {
        addToast("Session expired", "error");
        navigate("/login");
      } else {
        addToast("Network error", "error");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div class="max-w-3xl mx-auto p-6">
      <Show when={!note.loading} fallback={<div class="animate-pulse text-ink-secondary">Loading note...</div>}>
        <Show when={!note.error} fallback={
          <div class="text-center py-12">
            <p class="text-error mb-3">{note.error?.message}</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm">Try again</button>
          </div>
        }>
          <Show when={note()}>
            {(n) => (
              <Switch>
                {/* ── View mode ───────────────────────────────── */}
                <Match when={!isEditing()}>
                  <article>
                    <div class="flex items-start justify-between mb-6">
                      <div>
                        <h1 class="text-3xl font-display font-bold text-ink-primary">{n().title}</h1>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                          <span class="text-sm text-ink-secondary">{n().wordCount} words</span>
                          {n().category && (
                            <span class="text-xs px-2 py-0.5 rounded border border-surface-border text-ink-secondary">{n().category}</span>
                          )}
                          {n().tags?.length > 0 && n().tags.map((tag) => (
                            <span class="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">{tag}</span>
                          ))}
                          {n().isPublic && (
                            <span class="text-xs px-2 py-0.5 rounded bg-success-bg text-success">Public</span>
                          )}
                          <span class="text-xs text-ink-secondary/50">v{n().version}</span>
                        </div>
                        <div class="flex items-center gap-2 mt-1.5 text-xs text-ink-secondary/60">
                          <span>Created {timeAgo(n().createdAt)}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>Updated {timeAgo(n().updatedAt)}</span>
                        </div>
                      </div>
                      <Show when={n().isOwner}>
                        <div class="flex items-center gap-2">
                          <button onClick={() => startEditing(n())} class="px-3 py-1.5 text-sm bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors">Edit</button>
                          <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting()} class="px-3 py-1.5 text-sm text-error hover:bg-error-bg rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{deleting() ? "Trashing..." : "Trash"}</button>
                        </div>
                      </Show>
                    </div>

                    {/* Rendered markdown content */}
                    <div class="prose max-w-none text-sm" innerHTML={renderMarkdown(n().content)} />

                    <Show when={n().aiSummary}>
                      <div class="mt-8 p-4 bg-surface-elevated rounded-lg border border-surface-border">
                        <h3 class="text-sm font-medium text-ink-secondary mb-2">AI Summary</h3>
                        <p class="text-sm text-ink-primary">{n().aiSummary}</p>
                      </div>
                    </Show>
                    <div class="mt-6">
                      <A href="/notes" class="text-sm text-accent hover:underline">&larr; Back to notes</A>
                    </div>
                  </article>
                </Match>

                {/* ── Edit mode ────────────────────────────────── */}
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

                    {/* Category + Public toggle */}
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

                    {/* Tags */}
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

                    <label for="edit-content" class="sr-only">Content</label>
                    <textarea
                      id="edit-content"
                      value={editContent()}
                      onInput={(e) => setEditContent(e.currentTarget.value)}
                      rows={25}
                      class="w-full rounded-md border border-surface-border px-3 py-2 text-ink-primary bg-surface font-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y min-h-[400px]"
                    />
                    <div class="flex items-center gap-3">
                      <button onClick={saveEdit} disabled={saving()} class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors">
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
        title="Move to trash"
        message="Are you sure you want to move this note to the trash?"
        confirmLabel="Move to Trash"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmModal
        open={showDiscardConfirm()}
        title="Discard changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        variant="danger"
        onConfirm={() => { setShowDiscardConfirm(false); setIsEditing(false); }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}

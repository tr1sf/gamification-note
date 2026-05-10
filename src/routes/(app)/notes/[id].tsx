import { createResource, createSignal, Show, Switch, Match } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";

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
  const [saving, setSaving] = createSignal(false);

  const [note, { refetch }] = createResource(() => params.id, fetchNote);

  const startEditing = (n: Note) => {
    setEditTitle(n.title);
    setEditContent(n.content);
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
          version: note()!.version,
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast("Scroll updated!", "success");
        setIsEditing(false);
        refetch();
      } else if (json.error?.code === "CONFLICT") {
        addToast("This scroll was modified elsewhere. Please refresh and try again.", "error");
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
    if (n && (editTitle() !== n.title || editContent() !== n.content)) {
      if (!confirm("You have unsaved changes. Discard them?")) return;
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Move this scroll to the trash?")) return;
    try {
      const res = await authFetch(`/api/notes/${params.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        addToast("Scroll moved to trash", "info");
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
    }
  };

  return (
    <div class="max-w-3xl mx-auto p-6">
      <Show when={!note.loading} fallback={<div class="animate-pulse text-ink-secondary">Loading scroll...</div>}>
        <Show when={!note.error} fallback={
          <div class="text-center py-12">
            <p class="text-error mb-3">{note.error?.message}</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm">Try again</button>
          </div>
        }>
          <Show when={note()}>
            {(n) => (
              <Switch>
                <Match when={!isEditing()}>
                  <article>
                    <div class="flex items-start justify-between mb-6">
                      <div>
                        <h1 class="text-3xl font-display font-bold text-ink-primary">{n().title}</h1>
                        <div class="flex items-center gap-3 mt-2 text-sm text-ink-secondary">
                          <span>{n().wordCount} words</span>
                          {n().category && <span class="px-2 py-0.5 rounded border border-surface-border">{n().category}</span>}
                          {n().isPublic && <span class="px-2 py-0.5 rounded bg-success-bg text-success">Public</span>}
                          <span>v{n().version}</span>
                        </div>
                      </div>
                      <Show when={n().isOwner}>
                        <div class="flex items-center gap-2">
                          <button onClick={() => startEditing(n())} class="px-3 py-1.5 text-sm bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors">Edit</button>
                          <button onClick={handleDelete} class="px-3 py-1.5 text-sm text-error hover:bg-error-bg rounded-md transition-colors">Trash</button>
                        </div>
                      </Show>
                    </div>
                    <div class="prose max-w-none text-ink-primary whitespace-pre-wrap">
                      {n().content}
                    </div>
                    <Show when={n().aiSummary}>
                      <div class="mt-8 p-4 bg-surface-elevated rounded-lg border border-surface-border">
                        <h3 class="text-sm font-medium text-ink-secondary mb-2">AI Summary</h3>
                        <p class="text-sm text-ink-primary">{n().aiSummary}</p>
                      </div>
                    </Show>
                    <div class="mt-4">
                      <a href="/notes" class="text-sm text-accent hover:underline">← Back to scrolls</a>
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
    </div>
  );
}

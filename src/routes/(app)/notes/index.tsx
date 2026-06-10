import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { timeAgo } from "~/lib/time-ago";
import Breadcrumb from "~/components/ui/Breadcrumb";

interface NoteItem {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  isPublic: boolean;
  wordCount: number;
  excerpt: string;
  updatedAt: string;
}

async function fetchNotes(): Promise<NoteItem[]> {
  if (typeof document === "undefined") return []; // SSR — don't fetch
  const res = await authFetch("/api/notes?take=20");
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Failed to load notes");
  return json.data?.items || [];
}

export default function NotesPage() {
  const [notes, { refetch }] = createResource(fetchNotes);
  const [search, setSearch] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<NoteItem[] | null>(null);
  const [searching, setSearching] = createSignal(false);
  let searchTimer: ReturnType<typeof setTimeout>;
  let abortController: AbortController | null = null;

  const handleSearchInput = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer);
    if (value.length < 2) {
      setSearchResults(null);
      return;
    }
    searchTimer = setTimeout(() => doSearch(value), 300);
  };

  const doSearch = async (q: string) => {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    setSearching(true);
    try {
      const res = await authFetch(`/api/notes/search?q=${encodeURIComponent(q)}`, { signal: abortController.signal });
      const json = await res.json();
      setSearchResults(json.data || []);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        addToast("Search failed", "error");
      }
    } finally {
      setSearching(false);
    }
  };

  const displayed = () => searchResults() ?? notes();
  const isSearching = () => search().length >= 2 && searchResults() !== null;

  return (
    <div class="max-w-3xl mx-auto p-6">
      <Breadcrumb items={[{ label: "My Notes" }]} />
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-display font-bold text-ink-primary">My Notes</h1>
        <A href="/notes/new" class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover hover:shadow-md hover:shadow-accent/20 active:scale-[0.98] transition-all duration-150">
          + New Note
        </A>
      </div>

      {/* ── Search ────────────────────────────────────────────── */}
      <div class="mb-6">
        <label for="note-search" class="sr-only">Search notes</label>
        <div class="relative">
          <input
            id="note-search"
            type="search"
            placeholder="Search your notes..."
            value={search()}
            onInput={(e) => handleSearchInput(e.currentTarget.value)}
            class="w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm text-ink-primary bg-surface placeholder:text-ink-secondary/40 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-150"
          />
          <Show when={search().length > 0 && !isSearching()}>
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchResults(null); }}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary/50 hover:text-ink-primary text-sm"
              aria-label="Clear search"
            >
              &times;
            </button>
          </Show>
        </div>
      </div>

      {/* ── Loading state ─────────────────────────────────────── */}
      <Show when={!notes.loading && !notes.error} fallback={
        <Show when={notes.loading}>
          <div class="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div class="h-24 bg-surface-elevated rounded-lg border border-surface-border animate-pulse" />
            ))}
          </div>
        </Show>
      }>
        {/* ── Error state ─────────────────────────────────────── */}
        <Show when={notes.error}>
          <div class="text-center py-16">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error-bg mb-4" aria-hidden="true">
              <span class="text-2xl">&#9888;</span>
            </div>
            <p class="text-error font-medium mb-3">Failed to load notes</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm font-medium">Try again</button>
          </div>
        </Show>

        {/* ── Empty / No results ──────────────────────────────── */}
        <Show when={!notes.error}>
          <Show when={displayed()?.length} fallback={
            <div class="text-center py-12 text-ink-secondary">
              {isSearching() ? (
                <>
                  <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-elevated border border-surface-border mb-4" aria-hidden="true">
                    <span class="text-3xl">&#128269;</span>
                  </div>
                  <p class="text-ink-primary font-medium mb-1">No notes match "{search()}"</p>
                  <p class="text-ink-secondary/60 text-sm mb-4">Try a different search or clear to see all notes</p>
                  <button onClick={() => { setSearch(""); setSearchResults(null); }} class="text-accent hover:underline text-sm font-medium">Clear search</button>
                </>
              ) : (
                <>
                  <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-elevated border border-surface-border mb-4" aria-hidden="true">
                    <span class="text-3xl">&#128221;</span>
                  </div>
                  <p class="text-ink-primary font-medium mb-1">No notes yet</p>
                  <p class="text-ink-secondary/60 text-sm mb-4">Start writing your first note</p>
                  <A href="/notes/new" class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors">+ New Note</A>
                </>
              )}
            </div>
          }>
            {/* ── Note list ────────────────────────────────────── */}
            <div class="space-y-3">
              <Show when={searching()}>
                <p class="text-xs text-ink-secondary">Searching...</p>
              </Show>
              <For each={displayed()}>
                {(note) => (
                  <A
                    href={`/notes/${note.id}`}
                    class="block p-4 rounded-lg border border-surface-border bg-surface-elevated hover:border-accent/20 hover:shadow-md hover:shadow-accent/5 active:scale-[0.995] transition-all duration-150"
                  >
                    <div class="min-w-0">
                      <h3 class="font-semibold text-ink-primary truncate">
                        {note.title || "Untitled Note"}
                      </h3>
                      <Show when={note.excerpt}>
                        <p class="text-sm text-ink-secondary mt-1 line-clamp-2">{note.excerpt}</p>
                      </Show>
                    </div>

                    {/* Tags */}
                    <Show when={note.tags?.length > 0}>
                      <div class="flex flex-wrap gap-1.5 mt-2">
                        <For each={note.tags}>
                          {(tag) => (
                            <span class="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                              {tag}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* Meta row */}
                    <div class="flex items-center gap-3 mt-2 text-xs text-ink-secondary">
                      <span>{note.wordCount} words</span>
                      <span class="text-ink-secondary/30">&middot;</span>
                      <span>{timeAgo(note.updatedAt)}</span>
                      <span class="text-ink-secondary/30">&middot;</span>
                      <Show when={note.category}>
                        <span class="px-1.5 py-0.5 rounded border border-surface-border">{note.category}</span>
                      </Show>
                      <Show when={note.isPublic}>
                        <span class="px-1.5 py-0.5 rounded bg-success-bg text-success">Public</span>
                      </Show>
                    </div>
                  </A>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

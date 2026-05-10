import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";

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
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-display font-bold text-ink-primary">My Scrolls</h1>
        <A href="/notes/new" class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors">
          + New Scroll
        </A>
      </div>

      <div class="mb-6">
        <label for="note-search" class="sr-only">Search notes</label>
        <input
          id="note-search"
          type="search"
          placeholder="Search your scrolls..."
          value={search()}
          onInput={(e) => handleSearchInput(e.currentTarget.value)}
          class="w-full rounded-md border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <Show when={!notes.loading && !notes.error} fallback={
        <Show when={notes.loading}>
          <div class="text-ink-secondary animate-pulse">Loading scrolls...</div>
        </Show>
      }>
        <Show when={notes.error}>
          <div class="text-center py-12">
            <p class="text-error mb-3">Failed to load scrolls</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm">Try again</button>
          </div>
        </Show>
        <Show when={!notes.error}>
          <Show when={displayed()?.length} fallback={
            <div class="text-center py-12 text-ink-secondary">
              {isSearching() ? (
                <>
                  <p class="text-4xl mb-3">🔍</p>
                  <p>No scrolls match "{search()}"</p>
                  <button onClick={() => { setSearch(""); setSearchResults(null); }} class="text-accent hover:underline text-sm mt-2 inline-block">Clear search</button>
                </>
              ) : (
                <>
                  <p class="text-4xl mb-3">📜</p>
                  <p>Your scroll case is empty.</p>
                  <A href="/notes/new" class="text-accent hover:underline text-sm mt-2 inline-block">Write your first note</A>
                </>
              )}
            </div>
          }>
            <div class="space-y-3">
              <Show when={searching()}>
                <p class="text-xs text-ink-secondary">Searching...</p>
              </Show>
              <For each={displayed()}>
                {(note) => (
                  <A href={`/notes/${note.id}`} class="block p-4 rounded-lg border border-surface-border bg-surface-elevated hover:shadow-sm transition-shadow">
                    <div class="flex items-start justify-between">
                      <div class="min-w-0 flex-1">
                        <h3 class="font-medium text-ink-primary truncate">{note.title || "Untitled Scroll"}</h3>
                        <p class="text-sm text-ink-secondary mt-1 truncate">{note.excerpt}</p>
                      </div>
                      <div class="flex items-center gap-2 ml-4 shrink-0">
                        {note.isPublic && <span class="text-xs px-2 py-0.5 rounded bg-success-bg text-success">Public</span>}
                        {note.category && <span class="text-xs px-2 py-0.5 rounded border border-surface-border text-ink-secondary">{note.category}</span>}
                      </div>
                    </div>
                    <div class="flex items-center gap-3 mt-2 text-xs text-ink-secondary">
                      <span>{note.wordCount} words</span>
                      <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
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

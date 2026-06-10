import { createResource, Show, For } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { timeAgo } from "~/lib/time-ago";

interface PublicProfile {
  user: { id: string; username: string; avatarUrl: string | null; level: number; title: string; createdAt: string };
  notes: Array<{ id: string; title: string; excerpt: string; category: string | null; tags: string[]; wordCount: number; updatedAt: string }>;
}

async function fetchProfile(username: string): Promise<PublicProfile> {
  if (typeof document === "undefined") throw new Error("SSR");
  const res = await fetch(`/api/users/${username}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Not found");
  return json.data;
}

export default function PublicProfilePage() {
  const params = useParams();
  const [profile] = createResource(() => params.username, fetchProfile);

  return (
    <div class="min-h-screen bg-surface">
      <header class="border-b border-surface-border bg-surface-elevated">
        <div class="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <A href="/" class="text-lg font-display font-bold text-accent hover:text-accent-hover transition-colors">TavernoteX</A>
          <div class="flex items-center gap-3">
            <A href="/login" class="text-sm text-ink-secondary hover:text-accent transition-colors">Sign in</A>
            <A href="/register" class="px-3 py-1.5 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors">Join free</A>
          </div>
        </div>
      </header>

      <main class="max-w-3xl mx-auto p-6">
        <Show when={!profile.loading} fallback={<div class="animate-pulse space-y-3"><div class="h-8 w-32 bg-surface-border rounded" /><div class="h-4 w-48 bg-surface-border rounded" /></div>}>
          <Show when={!profile.error} fallback={
            <div class="text-center py-20">
              <p class="text-4xl mb-4">🛡️</p>
              <p class="text-ink-primary font-medium">User not found</p>
              <A href="/" class="text-accent hover:underline text-sm mt-3 inline-block">Go home</A>
            </div>
          }>
            <Show when={profile()}>{(p) => (
              <>
                <div class="mb-8">
                  <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold" aria-label={p().user.username}>
                      {p().user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h1 class="text-2xl font-display font-bold text-ink-primary">{p().user.username}</h1>
                      <p class="text-sm text-ink-secondary">Lv.{p().user.level} {p().user.title}</p>
                    </div>
                  </div>
                </div>

                <h2 class="text-lg font-display font-semibold text-ink-primary mb-4">Public Notes ({p().notes.length})</h2>
                <Show when={p().notes.length > 0} fallback={
                  <p class="text-ink-secondary text-sm">No public notes yet.</p>
                }>
                  <div class="space-y-3">
                    <For each={p().notes}>
                      {(note) => (
                        <A href={`/share/${note.id}`} class="block p-4 rounded-lg border border-surface-border bg-surface-elevated hover:border-accent/20 hover:shadow-md transition-all">
                          <h3 class="font-semibold text-ink-primary">{note.title || "Untitled"}</h3>
                          <p class="text-sm text-ink-secondary mt-1 line-clamp-2">{note.excerpt}</p>
                          <div class="flex items-center gap-3 mt-2 text-xs text-ink-secondary">
                            <span>{note.wordCount} words</span>
                            <span>{timeAgo(note.updatedAt)}</span>
                            {note.category && <span class="px-1.5 py-0.5 rounded border border-surface-border">{note.category}</span>}
                          </div>
                        </A>
                      )}
                    </For>
                  </div>
                </Show>
              </>
            )}</Show>
          </Show>
        </Show>
      </main>
    </div>
  );
}

import { createResource, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { renderMarkdown } from "~/lib/markdown";
import { isBlockContent, parseBlocks } from "~/lib/blocks";
import BlockRenderer from "~/components/editor/BlockRenderer";
import { timeAgo } from "~/lib/time-ago";

interface PublicNote {
  id: string; title: string; content: string; category: string | null;
  tags: string[]; wordCount: number; version: number;
  aiImageUrl: string | null; createdAt: string; updatedAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
}

async function fetchPublicNote(id: string): Promise<PublicNote> {
  if (typeof document === "undefined") throw new Error("SSR");
  const res = await fetch(`/api/notes/public/${id}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Not found");
  return json.data;
}

export default function PublicNotePage() {
  const params = useParams();
  const [note] = createResource(() => params.id, fetchPublicNote);

  return (
    <div class="min-h-screen bg-surface">
      <header class="border-b border-surface-border bg-surface-elevated">
        <div class="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <A href="/" class="text-lg font-display font-bold text-accent hover:text-accent-hover transition-colors">
            TavernoteX
          </A>
          <div class="flex items-center gap-3">
            <A href="/login" class="text-sm text-ink-secondary hover:text-accent transition-colors">Sign in</A>
            <A href="/register" class="px-3 py-1.5 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors">Join free</A>
          </div>
        </div>
      </header>

      <main class="max-w-3xl mx-auto p-6">
        <Show when={!note.loading} fallback={
          <div class="space-y-3 animate-pulse">
            <div class="h-8 w-64 bg-surface-border rounded" />
            <div class="h-4 w-32 bg-surface-border rounded" />
            <div class="h-64 bg-surface-border rounded mt-6" />
          </div>
        }>
          <Show when={!note.error} fallback={
            <div class="text-center py-20">
              <p class="text-4xl mb-4">📜</p>
              <h2 class="text-xl font-display font-bold text-ink-primary mb-2">Note not found</h2>
              <p class="text-ink-secondary text-sm mb-6">This note is private or has been deleted.</p>
              <A href="/" class="text-accent hover:underline text-sm font-medium">Go home</A>
            </div>
          }>
            <Show when={note()}>{(n) => (
              <article>
                <Show when={n().aiImageUrl}>
                  <img src={n().aiImageUrl ?? undefined} alt="" class="w-full h-48 object-cover rounded-lg mb-6" />
                </Show>
                <h1 class="text-3xl font-display font-bold text-ink-primary mb-3">{n().title}</h1>
                <div class="flex flex-wrap items-center gap-3 text-sm text-ink-secondary mb-6">
                  <A href={`/profile/${n().user.username}`} class="flex items-center gap-2 hover:text-accent transition-colors">
                    <span class="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold">
                      {n().user.username.charAt(0).toUpperCase()}
                    </span>
                    <span class="font-medium">{n().user.username}</span>
                  </A>
                  <span>{n().wordCount} words</span>
                  <span>{timeAgo(n().updatedAt)}</span>
                  {n().category && <span class="px-2 py-0.5 rounded border border-surface-border text-xs">{n().category}</span>}
                </div>

                <Show
                  when={isBlockContent(n().content)}
                  fallback={<div class="prose max-w-none text-sm" innerHTML={renderMarkdown(n().content)} />}
                >
                  <BlockRenderer blocks={parseBlocks(n().content)} />
                </Show>

                <div class="mt-12 pt-6 border-t border-surface-border text-center">
                  <p class="text-sm text-ink-secondary mb-3">Created with <A href="/" class="text-accent hover:underline">TavernoteX</A></p>
                  <A href="/register" class="inline-block px-5 py-2 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors">
                    Start your own journey
                  </A>
                </div>
              </article>
            )}</Show>
          </Show>
        </Show>
      </main>
    </div>
  );
}

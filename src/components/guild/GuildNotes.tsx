import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { timeAgo } from "~/lib/time-ago";
import type { GuildNote } from "~/stores/guild";
import Nelar from "~/components/mascot/Nelar";
import { t } from "~/lib/i18n";

interface OwnNote {
  id: string;
  title: string;
  excerpt: string;
  wordCount: number;
  updatedAt: string;
}

interface GuildNotesProps {
  notes: GuildNote[];
  currentUserId?: string;
  canModerate: boolean;
  onShare: (noteId: string) => void | Promise<void>;
  onUnshare: (noteId: string) => void | Promise<void>;
}

async function loadOwnNotes(): Promise<OwnNote[]> {
  if (typeof document === "undefined") return [];
  try {
    const res = await authFetch("/api/notes?take=50");
    const json = await res.json();
    return json.success ? (json.data?.items ?? []) : [];
  } catch {
    return [];
  }
}

export default function GuildNotes(props: GuildNotesProps) {
  const [showShare, setShowShare] = createSignal(false);
  const [ownNotes] = createResource(showShare, (open) => (open ? loadOwnNotes() : Promise.resolve([])));

  const sharedIds = () => new Set(props.notes.map((n) => n.id));

  const canUnshare = (note: GuildNote) =>
    props.canModerate || note.author.id === props.currentUserId;

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-ink-secondary">
          {props.notes.length} {props.notes.length === 1 ? t("scroll") : t("scrolls")} {t("shared")}
        </h2>
        <button
          onClick={() => setShowShare(true)}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          📜 {t("Share a scroll")}
        </button>
      </div>

      <Show
        when={props.notes.length > 0}
        fallback={
          <div class="text-center py-12 text-ink-secondary">
            <Nelar state="idle" size={56} class="mx-auto mb-2" />
            <p class="text-sm">{t("No scrolls shared yet. Share knowledge with your guild!")}</p>
          </div>
        }
      >
        <div class="space-y-2">
          <For each={props.notes}>
            {(note) => {
              const body = (
                <>
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="font-semibold text-ink-primary">{note.title || t("Untitled")}</h3>
                    <Show when={!note.isPublic}>
                      <span class="text-xs text-ink-secondary shrink-0" title="Private scroll">🔒</span>
                    </Show>
                  </div>
                  <p class="text-sm text-ink-secondary mt-1 line-clamp-2">{note.excerpt}</p>
                  <div class="flex items-center gap-3 mt-2 text-xs text-ink-secondary">
                    <span>{t("by")} {note.author.username}</span>
                    <span>{note.wordCount} {t("words")}</span>
                    <span>{timeAgo(note.updatedAt)}</span>
                    {note.category && (
                      <span class="px-1.5 py-0.5 rounded border border-surface-border">{note.category}</span>
                    )}
                  </div>
                </>
              );

              return (
                <div class="p-4 rounded-lg border border-surface-border bg-surface-elevated">
                  <Show when={note.isPublic} fallback={<div>{body}</div>}>
                    <A href={`/share/${note.id}`} class="block hover:opacity-80 transition-opacity">
                      {body}
                    </A>
                  </Show>
                  <Show when={canUnshare(note)}>
                    <div class="mt-2 pt-2 border-t border-surface-border flex justify-end">
                      <button
                        onClick={() => props.onUnshare(note.id)}
                        class="text-xs text-ink-secondary/70 hover:text-error transition-colors"
                      >
                        {t("Remove from guild")}
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Share modal */}
      <Show when={showShare()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowShare(false)}
        >
          <div
            class="w-full max-w-md max-h-[70vh] flex flex-col rounded-xl border border-surface-border bg-surface-elevated shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="p-4 border-b border-surface-border flex items-center justify-between">
              <h3 class="font-display font-bold text-ink-primary">{t("Share a scroll")}</h3>
              <button
                onClick={() => setShowShare(false)}
                class="text-ink-secondary hover:text-ink-primary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
              <Show
                when={!ownNotes.loading}
                fallback={<p class="text-sm text-ink-secondary text-center py-8">{t("Loading your scrolls...")}</p>}
              >
                <Show
                  when={(ownNotes() ?? []).length > 0}
                  fallback={<p class="text-sm text-ink-secondary text-center py-8">{t("You have no scrolls to share yet.")}</p>}
                >
                  <For each={ownNotes()}>
                    {(note) => {
                      const already = () => sharedIds().has(note.id);
                      return (
                        <button
                          disabled={already()}
                          onClick={async () => {
                            await props.onShare(note.id);
                            setShowShare(false);
                          }}
                          class="w-full text-left p-3 rounded-lg border border-surface-border hover:border-accent hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-sm font-medium text-ink-primary truncate">
                              {note.title || t("Untitled")}
                            </span>
                            <Show when={already()}>
                              <span class="text-xs text-ink-secondary shrink-0">{t("Shared")}</span>
                            </Show>
                          </div>
                          <p class="text-xs text-ink-secondary mt-0.5 line-clamp-1">{note.excerpt}</p>
                        </button>
                      );
                    }}
                  </For>
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

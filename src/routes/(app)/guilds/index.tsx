import { createSignal, createResource, For, Show } from "solid-js";
import { fetchGuilds, type Guild } from "~/stores/guild";
import GuildCard from "~/components/guild/GuildCard";
import CreateGuild from "~/components/guild/CreateGuild";

async function loadGuilds(): Promise<Guild[]> {
  if (typeof document === "undefined") return []; // SSR — don't fetch
  return fetchGuilds();
}

export default function GuildsPage() {
  const [guildsData, { refetch }] = createResource(loadGuilds);
  const [search, setSearch] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);

  const filteredGuilds = () => {
    const list = guildsData() || [];
    const q = search().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q)
    );
  };

  return (
    <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Discover Guilds</h1>
          <p class="text-sm text-ink-secondary mt-1">Join a guild or create your own</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover hover:shadow-md hover:shadow-accent/20 active:scale-[0.98] transition-all duration-150 shrink-0"
        >
          + Create Guild
        </button>
      </div>

      <div>
        <label for="guild-search" class="sr-only">Search guilds</label>
        <input
          id="guild-search"
          type="search"
          placeholder="Search guilds..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          class="w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm text-ink-primary bg-surface placeholder:text-ink-secondary/40 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-150"
        />
      </div>

      <Show
        when={!guildsData.loading}
        fallback={
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div class="h-40 rounded-lg border border-surface-border animate-pulse" style="background: linear-gradient(90deg, var(--color-surface-elevated) 25%, var(--color-surface-hover) 50%, var(--color-surface-elevated) 75%); background-size: 200% 100%;" />
            ))}
          </div>
        }
      >
        <Show when={guildsData.error}>
          <div class="text-center py-16">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error-bg mb-4" aria-hidden="true">
              <span class="text-2xl">⚠</span>
            </div>
            <p class="text-error font-medium mb-3">Failed to load guilds</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm font-medium">Try again</button>
          </div>
        </Show>

        <Show when={!guildsData.error}>
          <Show
            when={filteredGuilds().length > 0}
            fallback={
              <div class="text-center py-12 text-ink-secondary">
                <Show
                  when={search()}
                  fallback={
                    <>
                      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-elevated border border-surface-border mb-4" aria-hidden="true">
                        <span class="text-3xl">🏛️</span>
                      </div>
                      <p class="text-ink-primary font-medium mb-1">No guilds found</p>
                      <p class="text-ink-secondary/60 text-sm mb-4">Create the first guild and start your fellowship</p>
                      <button
                        onClick={() => setShowCreate(true)}
                        class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                      >
                        + Create Guild
                      </button>
                    </>
                  }
                >
                  <>
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-elevated border border-surface-border mb-4" aria-hidden="true">
                      <span class="text-3xl">🔍</span>
                    </div>
                    <p class="text-ink-primary font-medium mb-1">No guilds match "{search()}"</p>
                    <p class="text-ink-secondary/60 text-sm mb-4">Try a different search term</p>
                    <button
                      onClick={() => setSearch("")}
                      class="text-accent hover:underline text-sm font-medium"
                    >
                      Clear search
                    </button>
                  </>
                </Show>
              </div>
            }
          >
            <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <For each={filteredGuilds()}>
                {(guild) => <GuildCard guild={guild} />}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={showCreate()}>
        <CreateGuild onClose={() => setShowCreate(false)} />
      </Show>
    </div>
  );
}

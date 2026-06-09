import { createSignal, createResource, For, Show } from "solid-js";
import { fetchGuilds, type Guild } from "~/stores/guild";
import GuildCard from "~/components/guild/GuildCard";
import CreateGuild from "~/components/guild/CreateGuild";

async function loadGuilds(): Promise<Guild[]> {
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
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Discover Guilds</h1>
          <p class="text-sm text-ink-secondary mt-1">Join a guild or create your own</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors shrink-0"
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
          class="w-full rounded-md border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <Show
        when={!guildsData.loading}
        fallback={
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div class="h-40 bg-surface-border rounded-lg animate-pulse" />
            ))}
          </div>
        }
      >
        <Show when={guildsData.error}>
          <div class="text-center py-12">
            <p class="text-error mb-3">Failed to load guilds</p>
            <button onClick={() => refetch()} class="text-accent hover:underline text-sm">Try again</button>
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
                      <p class="text-4xl mb-3">🏛️</p>
                      <p>No guilds found. Create the first one!</p>
                      <button
                        onClick={() => setShowCreate(true)}
                        class="text-accent hover:underline text-sm mt-2 inline-block"
                      >
                        Create a guild
                      </button>
                    </>
                  }
                >
                  <>
                    <p class="text-4xl mb-3">🔍</p>
                    <p>No guilds match "{search()}"</p>
                    <button
                      onClick={() => setSearch("")}
                      class="text-accent hover:underline text-sm mt-2 inline-block"
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

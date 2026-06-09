export default function TavernPage() {
  return (
    <div class="max-w-3xl mx-auto p-6 text-center">
      <div class="mb-2" aria-hidden="true">
        <span class="text-5xl">&#127984;</span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-display font-bold text-ink-primary mb-3">Welcome to the Tavern</h1>
      <div class="flex items-center justify-center gap-3 mb-6" aria-hidden="true">
        <span class="block h-px w-12 bg-gradient-to-r from-transparent to-surface-border" />
        <span class="text-xs text-ink-secondary/40 tracking-widest uppercase">Tavern Hall</span>
        <span class="block h-px w-12 bg-gradient-to-l from-transparent to-surface-border" />
      </div>
      <p class="text-ink-secondary text-lg mb-10">Your journey of knowledge begins here, adventurer.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
        <a href="/notes" class="group p-5 rounded-xl border border-surface-border bg-surface-elevated hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5 active:scale-[0.98] transition-all duration-200 text-left">
          <span class="text-2xl transition-transform duration-200 group-hover:scale-110 inline-block" aria-hidden="true">&#128221;</span>
          <h3 class="font-semibold text-ink-primary mt-2 group-hover:text-accent transition-colors">My Notes</h3>
          <p class="text-sm text-ink-secondary mt-1">Browse your notes</p>
        </a>
        <a href="/notes/new" class="group p-5 rounded-xl border border-surface-border bg-surface-elevated hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5 active:scale-[0.98] transition-all duration-200 text-left">
          <span class="text-2xl transition-transform duration-200 group-hover:scale-110 inline-block" aria-hidden="true">&#9997;&#65039;</span>
          <h3 class="font-semibold text-ink-primary mt-2 group-hover:text-accent transition-colors">Create Note</h3>
          <p class="text-sm text-ink-secondary mt-1">Write a new note</p>
        </a>
      </div>
    </div>
  );
}

export default function TavernPage() {
  return (
    <div class="max-w-3xl mx-auto p-6 text-center">
      <h1 class="text-4xl font-display font-bold text-ink-primary mb-4">🏰 Welcome to the Tavern</h1>
      <p class="text-ink-secondary text-lg mb-8">Your journey of knowledge begins here, adventurer.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
        <a href="/notes" class="p-4 rounded-lg border border-surface-border bg-surface-elevated hover:shadow transition-shadow text-left">
          <span class="text-2xl" aria-hidden="true">📜</span>
          <h3 class="font-medium text-ink-primary mt-2">My Scrolls</h3>
          <p class="text-sm text-ink-secondary">Browse your notes</p>
        </a>
        <a href="/notes/new" class="p-4 rounded-lg border border-surface-border bg-surface-elevated hover:shadow transition-shadow text-left">
          <span class="text-2xl" aria-hidden="true">🖊️</span>
          <h3 class="font-medium text-ink-primary mt-2">New Scroll</h3>
          <p class="text-sm text-ink-secondary">Write a new note</p>
        </a>
      </div>
    </div>
  );
}

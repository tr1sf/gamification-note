import { A } from "@solidjs/router";

export default function Home() {
  return (
    <main class="min-h-screen flex flex-col items-center justify-center bg-surface text-center p-8 relative overflow-hidden">
      <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]" style="background-image: radial-gradient(circle, rgb(var(--color-accent)) 1px, transparent 1px); background-size: 24px 24px;" aria-hidden="true" />
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-accent/30 to-transparent" aria-hidden="true" />
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-t from-accent/30 to-transparent" aria-hidden="true" />

      <div class="relative z-10 max-w-2xl mx-auto">
        <p class="text-sm font-medium text-accent tracking-widest uppercase mb-6">A Gamified Note-Taking Experience</p>
        <h1 class="text-6xl sm:text-7xl font-display font-extrabold text-ink-primary mb-6 leading-tight">
          TavernoteX
        </h1>
        <div class="flex items-center justify-center gap-4 mb-8" aria-hidden="true">
          <span class="block h-px flex-1 max-w-16 bg-gradient-to-r from-transparent to-surface-border" />
          <span class="text-2xl">🏰</span>
          <span class="block h-px flex-1 max-w-16 bg-gradient-to-l from-transparent to-surface-border" />
        </div>
        <p class="text-xl sm:text-2xl text-ink-secondary mb-10 max-w-lg mx-auto leading-relaxed">
          Your tavern of knowledge. Write scrolls, complete quests, and level up your learning journey.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <A href="/login" class="px-8 py-3.5 bg-accent text-white rounded-lg font-semibold text-lg hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 transition-all duration-200 active:scale-[0.98]">
            Enter the Tavern
          </A>
          <A href="/register" class="px-8 py-3.5 border-2 border-surface-border text-ink-primary rounded-lg font-semibold text-lg hover:border-accent/40 hover:bg-surface-elevated hover:shadow-md transition-all duration-200 active:scale-[0.98]">
            Create Account
          </A>
        </div>
        <p class="text-sm text-ink-secondary">
          Join <span class="font-semibold text-ink-primary">12,847</span> adventurers already writing their story
        </p>
      </div>
    </main>
  );
}

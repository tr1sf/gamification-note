import { A } from "@solidjs/router";

export default function Home() {
  return (
    <main class="min-h-screen flex flex-col items-center justify-center bg-surface text-center p-8">
      <h1 class="text-5xl font-display font-bold text-ink-primary mb-4">🏰 TavernoteX</h1>
      <p class="text-xl text-ink-secondary mb-8 max-w-md">
        Your tavern of knowledge. Write scrolls, complete quests, and level up your learning journey.
      </p>
      <div class="flex gap-3">
        <A href="/login" class="px-6 py-2.5 bg-accent text-white rounded-md font-medium hover:bg-accent-hover transition-colors">Enter Tavern</A>
        <A href="/register" class="px-6 py-2.5 border border-surface-border text-ink-primary rounded-md font-medium hover:bg-surface-elevated transition-colors">Create Account</A>
      </div>
    </main>
  );
}

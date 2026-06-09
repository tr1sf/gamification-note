import QuestBoard from "~/components/gamification/QuestBoard";

export default function QuestsPage() {
  return (
    <div class="max-w-4xl mx-auto p-6">
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-1">
          <span class="text-2xl" aria-hidden="true">📋</span>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Quest Board</h1>
        </div>
        <p class="text-sm text-ink-secondary ml-9">Complete quests to earn XP and coins</p>
      </div>
      <QuestBoard />
    </div>
  );
}

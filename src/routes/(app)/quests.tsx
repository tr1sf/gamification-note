import QuestBoard from "~/components/gamification/QuestBoard";

export default function QuestsPage() {
  return (
    <div class="max-w-4xl mx-auto p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-display font-bold text-ink-primary">Quest Board</h1>
        <p class="text-sm text-ink-secondary mt-1">Complete quests to earn XP and coins</p>
      </div>
      <QuestBoard />
    </div>
  );
}

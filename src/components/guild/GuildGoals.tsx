import { createSignal, For, Show } from "solid-js";
import { createGoal, contributeGoal, type GuildGoal } from "~/stores/guild";
import { fetchMe } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import Nelar from "~/components/mascot/Nelar";
import { t } from "~/lib/i18n";

interface GuildGoalsProps {
  guildId: string;
  goals: GuildGoal[];
  canManage: boolean; // owner/admin
  onChanged: () => void | Promise<void>;
}

// Default end date helper — 7 days out, formatted for <input type="date">
function defaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function GuildGoals(props: GuildGoalsProps) {
  const [showCreate, setShowCreate] = createSignal(false);
  const [busy, setBusy] = createSignal<string | null>(null);

  // create form
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [targetCount, setTargetCount] = createSignal(10);
  const [endDate, setEndDate] = createSignal(defaultEndDate());
  const [rewardXp, setRewardXp] = createSignal(50);
  const [rewardCoins, setRewardCoins] = createSignal(15);
  const [saving, setSaving] = createSignal(false);

  const resetForm = () => {
    setTitle(""); setDescription(""); setTargetCount(10);
    setEndDate(defaultEndDate()); setRewardXp(50); setRewardCoins(15);
  };

  const activeGoals = () => props.goals.filter((g) => !g.isCompleted);
  const completedGoals = () => props.goals.filter((g) => g.isCompleted);

  const pct = (g: GuildGoal) =>
    Math.min(100, Math.round((g.currentCount / Math.max(1, g.targetCount)) * 100));

  const isExpired = (g: GuildGoal) => !g.isCompleted && new Date() > new Date(g.endDate);

  const deadlineLabel = (iso: string) => {
    const end = new Date(iso);
    const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return t("Ended");
    if (days === 0) return t("Ends today");
    if (days === 1) return t("1 day left");
    return `${days} ${t("days left")}`;
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!title().trim() || targetCount() < 1 || !endDate()) {
      addToast(t("Enter a title, target, and end date"), "error");
      return;
    }
    setSaving(true);
    const created = await createGoal(props.guildId, {
      title: title().trim(),
      description: description().trim() || undefined,
      targetCount: targetCount(),
      endDate: new Date(endDate()).toISOString(),
      rewardXp: rewardXp(),
      rewardCoins: rewardCoins(),
    });
    setSaving(false);
    if (created) {
      addToast(t("Goal created"), "success");
      setShowCreate(false);
      resetForm();
      await props.onChanged();
    } else {
      addToast(t("Failed to create goal"), "error");
    }
  };

  const handleContribute = async (goal: GuildGoal) => {
    setBusy(goal.id);
    const result = await contributeGoal(props.guildId, goal.id);
    setBusy(null);
    if (!result) {
      addToast(t("Couldn't add your contribution"), "error");
      return;
    }
    if (result.isCompleted) {
      addToast(`"${goal.title}" ${t("reached! Rewards granted to the guild")} 🎉`, "success");
      // Rewards are granted server-side to every member — re-sync our own stats.
      fetchMe().catch(() => {});
    } else {
      addToast(`+1 — ${result.currentCount}/${goal.targetCount}`, "info");
    }
    await props.onChanged();
  };

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-ink-secondary">
          {activeGoals().length} {t("active")} {activeGoals().length === 1 ? t("goal") : t("goals")}
        </h2>
        <Show when={props.canManage}>
          <button
            onClick={() => setShowCreate(true)}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            + {t("New goal")}
          </button>
        </Show>
      </div>

      <Show
        when={props.goals.length > 0}
        fallback={
          <div class="text-center py-12 text-ink-secondary">
            <Nelar state="curious" size={56} class="mx-auto mb-2" />
            <p class="text-sm">
              {props.canManage
                ? t("No goals yet. Set a shared target for the guild to chase together.")
                : t("No guild goals yet. Check back soon!")}
            </p>
          </div>
        }
      >
        <div class="space-y-2">
          <For each={activeGoals()}>
            {(goal) => (
              <div class="p-4 rounded-lg border border-surface-border bg-surface-elevated">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold text-ink-primary">{goal.title}</h3>
                    <Show when={goal.description}>
                      <p class="text-sm text-ink-secondary mt-1">{goal.description}</p>
                    </Show>
                  </div>
                  <span
                    class={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                      isExpired(goal)
                        ? "bg-error-bg text-error"
                        : "bg-surface-border text-ink-secondary"
                    }`}
                  >
                    {isExpired(goal) ? t("Expired") : deadlineLabel(goal.endDate)}
                  </span>
                </div>

                {/* Progress */}
                <div class="mt-3 space-y-1.5">
                  <div class="flex items-center justify-between text-xs text-ink-secondary">
                    <span class="font-medium">{pct(goal)}%</span>
                    <span class="text-ink-secondary/60">{goal.currentCount}/{goal.targetCount}</span>
                  </div>
                  <div class="h-2.5 bg-surface-border rounded-full overflow-hidden">
                    <div
                      class="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${pct(goal)}%` }}
                    />
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3 mt-3">
                  <div class="flex items-center gap-3 text-xs text-ink-secondary flex-wrap">
                    <Show when={goal.rewardXp > 0}><span class="text-xp font-semibold">+{goal.rewardXp} {t("XP")}</span></Show>
                    <Show when={goal.rewardCoins > 0}><span class="text-coin font-semibold">+{goal.rewardCoins} 🪙</span></Show>
                    <span class="text-ink-secondary/60">{t("each member")}</span>
                  </div>
                  <button
                    onClick={() => handleContribute(goal)}
                    disabled={busy() === goal.id || isExpired(goal)}
                    class="px-3 py-1.5 bg-accent text-surface-overlay rounded-md text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                    title={isExpired(goal) ? "This goal has ended" : "Add one to the tally"}
                  >
                    {busy() === goal.id ? "..." : t("Contribute +1")}
                  </button>
                </div>
              </div>
            )}
          </For>

          {/* Completed goals */}
          <Show when={completedGoals().length > 0}>
            <p class="text-xs font-medium text-ink-secondary/60 pt-3">{t("Completed")}</p>
            <For each={completedGoals()}>
              {(goal) => (
                <div class="p-3 rounded-lg border border-success/20 bg-success/5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span aria-hidden="true">🏆</span>
                      <h3 class="font-medium text-ink-primary truncate">{goal.title}</h3>
                    </div>
                    <span class="text-xs text-success shrink-0">
                      ✓ {goal.currentCount}/{goal.targetCount}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>

      {/* Create modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            class="w-full max-w-md rounded-xl border border-surface-border bg-surface-elevated shadow-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <h2 class="font-display font-bold text-ink-primary text-lg">{t("Set a guild goal")}</h2>

            <div>
              <label for="goal-title" class="block text-xs text-ink-secondary mb-1.5">{t("Title")}</label>
              <input
                id="goal-title"
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                maxLength={120}
                placeholder={t("e.g. Write 50 scrolls together")}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label for="goal-desc" class="block text-xs text-ink-secondary mb-1.5">{t("Details (optional)")}</label>
              <textarea
                id="goal-desc"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                maxLength={1000}
                rows={2}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>

            <div class="flex gap-3">
              <div class="flex-1">
                <label for="goal-target" class="block text-xs text-ink-secondary mb-1.5">{t("Target count")}</label>
                <input id="goal-target" type="number" min={1} max={10000} value={targetCount()}
                  onInput={(e) => setTargetCount(parseInt(e.currentTarget.value) || 1)}
                  class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div class="flex-1">
                <label for="goal-end" class="block text-xs text-ink-secondary mb-1.5">{t("Ends on")}</label>
                <input id="goal-end" type="date" value={endDate()}
                  onInput={(e) => setEndDate(e.currentTarget.value)}
                  class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>

            <div class="flex gap-3">
              <div class="flex-1">
                <label for="goal-xp" class="block text-xs text-ink-secondary mb-1.5">{t("XP per member")}</label>
                <input id="goal-xp" type="number" min={0} max={500} value={rewardXp()}
                  onInput={(e) => setRewardXp(parseInt(e.currentTarget.value) || 0)}
                  class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div class="flex-1">
                <label for="goal-coins" class="block text-xs text-ink-secondary mb-1.5">{t("Coins per member")}</label>
                <input id="goal-coins" type="number" min={0} max={200} value={rewardCoins()}
                  onInput={(e) => setRewardCoins(parseInt(e.currentTarget.value) || 0)}
                  class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>

            <p class="text-xs text-ink-secondary/60">
              {t("When the goal is reached, every guild member earns the reward.")}
            </p>

            <div class="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary">
                {t("Cancel")}
              </button>
              <button type="submit" disabled={saving()}
                class="px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
                {saving() ? t("Creating...") : t("Create goal")}
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}

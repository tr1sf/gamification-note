import { createSignal, createResource, For, Show } from "solid-js";
import { fetchHabits, createHabit, deleteHabit, checkinHabit, type Habit } from "~/stores/habits";
import { applyReward } from "~/stores/user";
import { showReward, addToast } from "~/stores/ui";
import Nelar from "~/components/mascot/Nelar";

const ICONS = ["✅", "📖", "🏃", "💧", "🧘", "🖊️", "🌅", "💪", "🎯", "🌙", "🍎", "🧹"];

async function loadHabits(): Promise<Habit[]> {
  if (typeof document === "undefined") return [];
  return fetchHabits();
}

export default function HabitsPage() {
  const [habits, { mutate }] = createResource(loadHabits);
  const [showCreate, setShowCreate] = createSignal(false);
  const [busy, setBusy] = createSignal<string | null>(null);

  // create form state
  const [title, setTitle] = createSignal("");
  const [icon, setIcon] = createSignal(ICONS[0]);
  const [description, setDescription] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const resetForm = () => {
    setTitle(""); setIcon(ICONS[0]); setDescription("");
  };

  const list = () => habits() ?? [];
  const doneCount = () => list().filter((h) => h.completedToday).length;

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!title().trim()) return;
    setSaving(true);
    const created = await createHabit({
      title: title().trim(),
      icon: icon(),
      description: description().trim() || undefined,
    });
    setSaving(false);
    if (created) {
      mutate((prev) => [...(prev ?? []), created]);
      setShowCreate(false);
      resetForm();
    } else {
      addToast("Failed to create habit", "error");
    }
  };

  const handleCheckin = async (habit: Habit) => {
    if (habit.completedToday || busy()) return;
    setBusy(habit.id);
    const result = await checkinHabit(habit.id);
    setBusy(null);
    if (!result) {
      addToast("Could not check in", "error");
      return;
    }
    applyReward(result);
    showReward({
      xp: result.xpGained,
      coins: result.coinsGained,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      newTitle: result.newTitle,
    });
    mutate((prev) =>
      (prev ?? []).map((h) =>
        h.id === habit.id
          ? { ...h, completedToday: true, currentStreak: result.currentStreak, bestStreak: result.bestStreak }
          : h
      )
    );
  };

  const handleDelete = async (habit: Habit) => {
    if (!confirm(`Delete habit "${habit.title}"?`)) return;
    const ok = await deleteHabit(habit.id);
    if (ok) {
      mutate((prev) => (prev ?? []).filter((h) => h.id !== habit.id));
    } else {
      addToast("Failed to delete habit", "error");
    }
  };

  return (
    <div class="max-w-3xl mx-auto p-6 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-display font-bold text-ink-primary">Daily Rituals</h1>
          <p class="text-sm text-ink-secondary mt-1">
            Build habits, keep your streak, earn XP every day.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors shrink-0"
        >
          + New Ritual
        </button>
      </div>

      <Show when={!habits.loading} fallback={
        <div class="space-y-3">
          {[1, 2, 3].map(() => <div class="h-20 rounded-xl border border-surface-border animate-pulse bg-surface-elevated" />)}
        </div>
      }>
        <Show when={list().length > 0}>
          <div class="flex items-center gap-2 text-sm text-ink-secondary">
            <div class="flex-1 h-2 rounded-full bg-surface-border overflow-hidden">
              <div
                class="h-full bg-accent transition-all duration-300"
                style={{ width: `${list().length ? (doneCount() / list().length) * 100 : 0}%` }}
              />
            </div>
            <span>{doneCount()}/{list().length} today</span>
          </div>
        </Show>

        <Show
          when={list().length > 0}
          fallback={
            <div class="text-center py-16 text-ink-secondary">
              <Nelar state="curious" size={56} class="mx-auto mb-2" />
              <p class="text-ink-primary font-medium mb-1">No rituals yet</p>
              <p class="text-sm mb-4">Create your first daily ritual to start a streak.</p>
              <button onClick={() => setShowCreate(true)} class="text-accent hover:underline text-sm font-medium">
                + New Ritual
              </button>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={list()}>
              {(habit) => (
                <div class="flex items-center gap-4 p-4 rounded-xl border border-surface-border bg-surface-elevated">
                  <div class="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center text-xl shrink-0">
                    {habit.icon}
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-ink-primary truncate">{habit.title}</h3>
                    <Show when={habit.description}>
                      <p class="text-xs text-ink-secondary truncate">{habit.description}</p>
                    </Show>
                    <div class="flex items-center gap-3 mt-1 text-xs">
                      <span class="text-xp font-semibold" title="Current streak">
                        🔥 {habit.currentStreak} day{habit.currentStreak === 1 ? "" : "s"}
                      </span>
                      <span class="text-ink-secondary">Best {habit.bestStreak}</span>
                      <span class="text-ink-secondary">+{habit.xpReward} XP</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCheckin(habit)}
                      disabled={habit.completedToday || busy() === habit.id}
                      class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        habit.completedToday
                          ? "bg-success-bg text-success cursor-default"
                          : "bg-accent text-surface-overlay hover:bg-accent-hover"
                      } disabled:opacity-60`}
                    >
                      {habit.completedToday ? "✓ Done" : busy() === habit.id ? "..." : "Check in"}
                    </button>
                    <button
                      onClick={() => handleDelete(habit)}
                      class="p-2 text-ink-secondary/60 hover:text-error transition-colors"
                      title="Delete ritual"
                      aria-label="Delete ritual"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* Create modal */}
      <Show when={showCreate()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            class="w-full max-w-md rounded-xl border border-surface-border bg-surface-elevated shadow-xl p-5 space-y-4"
          >
            <h2 class="font-display font-bold text-ink-primary text-lg">New Ritual</h2>

            <div>
              <label class="block text-xs text-ink-secondary mb-1.5">Icon</label>
              <div class="flex flex-wrap gap-1.5">
                <For each={ICONS}>
                  {(ic) => (
                    <button
                      type="button"
                      onClick={() => setIcon(ic)}
                      class={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors ${
                        icon() === ic ? "border-accent bg-accent/10" : "border-surface-border hover:border-accent/40"
                      }`}
                    >
                      {ic}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div>
              <label for="habit-title" class="block text-xs text-ink-secondary mb-1.5">Title</label>
              <input
                id="habit-title"
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                placeholder="e.g. Read for 20 minutes"
                maxLength={80}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label for="habit-desc" class="block text-xs text-ink-secondary mb-1.5">Description (optional)</label>
              <input
                id="habit-desc"
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                maxLength={300}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div class="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving() || !title().trim()}
                class="px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {saving() ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}

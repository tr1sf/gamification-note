import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";

const THEMES = [
  { id: "growth", icon: "🌱", label: "Growth" },
  { id: "journey", icon: "🧭", label: "Journey" },
  { id: "puzzle", icon: "🧩", label: "Puzzle" },
  { id: "star", icon: "⭐", label: "Constellation" },
  { id: "museum", icon: "🏛️", label: "Museum" },
  { id: "scholar", icon: "📚", label: "Scholar" },
];

const DIFFICULTIES = ["easy", "medium", "hard", "epic"];
const LINKED_ACTIONS = [
  { value: "", label: "None (manual)" },
  { value: "create_note", label: "Create Note" },
  { value: "review_note", label: "Review Note" },
  { value: "ai_summarize", label: "AI Summarize" },
  { value: "make_public", label: "Make Public" },
];

interface ActionDraft {
  title: string;
  iconEmoji: string;
  progressValue: number;
  linkedActionType: string;
  isRepeatable: boolean;
  maxRepeats: number | null;
}

export default function ChallengeCreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [theme, setTheme] = createSignal("growth");
  const [difficulty, setDifficulty] = createSignal("medium");
  const [iconEmoji, setIconEmoji] = createSignal("🌱");
  const [rewardXp, setRewardXp] = createSignal(100);
  const [rewardCoins, setRewardCoins] = createSignal(20);
  const [actions, setActions] = createSignal<ActionDraft[]>([]);
  const [saving, setSaving] = createSignal(false);

  const addAction = () => {
    setActions((prev) => [
      ...prev,
      { title: "", iconEmoji: "📝", progressValue: 20, linkedActionType: "", isRepeatable: false, maxRepeats: null },
    ]);
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: keyof ActionDraft, value: any) => {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const handleThemeChange = (t: string) => {
    setTheme(t);
    const found = THEMES.find((x) => x.id === t);
    if (found) setIconEmoji(found.icon);
  };

  const handleSubmit = async () => {
    if (!title().trim()) return addToast("Title is required", "error");
    setSaving(true);
    try {
      const body = {
        title: title().trim(),
        description: description().trim() || null,
        theme: theme(),
        difficulty: difficulty(),
        iconEmoji: iconEmoji(),
        rewardXp: rewardXp(),
        rewardCoins: rewardCoins(),
        actions: actions()
          .filter((a) => a.title.trim())
          .map((a) => ({
            title: a.title.trim(),
            iconEmoji: a.iconEmoji,
            progressValue: a.progressValue,
            linkedActionType: a.linkedActionType || null,
            isRepeatable: a.isRepeatable,
            maxRepeats: a.maxRepeats,
          })),
      };

      const res = await authFetch("/api/challenges", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        addToast("Challenge created!", "success");
        navigate(`/challenges/${json.data.id}`);
      } else {
        addToast(json.error?.message || "Failed to create", "error");
      }
    } catch {
      addToast("Failed to create challenge", "error");
    } finally {
      setSaving(false);
    }
  };

  const totalProgress = () => actions().reduce((sum, a) => sum + a.progressValue, 0);

  return (
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <h1 class="text-2xl font-display font-bold text-ink-primary">New Challenge</h1>

      {/* Basic Info */}
      <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border space-y-4">
        <div>
          <label class="block text-sm font-medium text-ink-primary mb-1">Title *</label>
          <input
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            placeholder="e.g., Learn React in 7 days"
            class="w-full px-4 py-2 rounded-lg bg-surface border border-surface-border text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none focus:border-accent/50 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-ink-primary mb-1">Description</label>
          <textarea
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="What's your goal?"
            rows={2}
            class="w-full px-4 py-2 rounded-lg bg-surface border border-surface-border text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none focus:border-accent/50 text-sm resize-none"
          />
        </div>
      </div>

      {/* Theme */}
      <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border space-y-3">
        <label class="block text-sm font-medium text-ink-primary">Theme</label>
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <For each={THEMES}>
            {(t) => (
              <button
                onClick={() => handleThemeChange(t.id)}
                class={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  theme() === t.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface-border text-ink-secondary hover:border-surface-border/80"
                }`}
              >
                <span class="text-xl">{t.icon}</span>
                <span class="text-xs">{t.label}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Difficulty */}
      <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border space-y-3">
        <label class="block text-sm font-medium text-ink-primary">Difficulty</label>
        <div class="flex gap-2">
          <For each={DIFFICULTIES}>
            {(d) => (
              <button
                onClick={() => setDifficulty(d)}
                class={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-all ${
                  difficulty() === d
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface-border text-ink-secondary hover:border-surface-border/80"
                }`}
              >
                {d}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Reward */}
      <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border space-y-4">
        <label class="block text-sm font-medium text-ink-primary">Reward</label>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-ink-secondary mb-1">XP</label>
            <input
              type="number"
              value={rewardXp()}
              onInput={(e) => setRewardXp(parseInt(e.currentTarget.value) || 0)}
              class="w-full px-4 py-2 rounded-lg bg-surface border border-surface-border text-xp font-medium focus:outline-none focus:border-accent/50 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-ink-secondary mb-1">Coins</label>
            <input
              type="number"
              value={rewardCoins()}
              onInput={(e) => setRewardCoins(parseInt(e.currentTarget.value) || 0)}
              class="w-full px-4 py-2 rounded-lg bg-surface border border-surface-border text-coin font-medium focus:outline-none focus:border-accent/50 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border space-y-4">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-ink-primary">
            Actions ({actions().length}) — Total: {totalProgress()} pts
          </label>
          <button
            onClick={addAction}
            class="text-sm text-accent hover:underline"
          >
            + Add Action
          </button>
        </div>
        <For each={actions()}>
          {(action, index) => (
            <div class="p-4 rounded-lg border border-surface-border bg-surface space-y-3">
              <div class="flex items-center gap-2">
                <input
                  value={action.title}
                  onInput={(e) => updateAction(index(), "title", e.currentTarget.value)}
                  placeholder="Action title"
                  class="flex-1 px-3 py-1.5 rounded bg-surface-elevated border border-surface-border text-ink-primary text-sm focus:outline-none focus:border-accent/50"
                />
                <button
                  onClick={() => removeAction(index())}
                  class="text-ink-secondary/50 hover:text-error text-sm px-1"
                >
                  ✕
                </button>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-ink-secondary">Icon:</span>
                  <input
                    value={action.iconEmoji}
                    onInput={(e) => updateAction(index(), "iconEmoji", e.currentTarget.value)}
                    class="w-12 px-2 py-1 rounded bg-surface-elevated border border-surface-border text-sm text-center focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-ink-secondary">Pts:</span>
                  <input
                    type="number"
                    value={action.progressValue}
                    onInput={(e) => updateAction(index(), "progressValue", parseInt(e.currentTarget.value) || 10)}
                    class="w-16 px-2 py-1 rounded bg-surface-elevated border border-surface-border text-sm text-center focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-ink-secondary">Link:</span>
                  <select
                    value={action.linkedActionType}
                    onChange={(e) => updateAction(index(), "linkedActionType", e.currentTarget.value)}
                    class="px-2 py-1 rounded bg-surface-elevated border border-surface-border text-xs focus:outline-none focus:border-accent/50"
                  >
                    <For each={LINKED_ACTIONS}>
                      {(la) => <option value={la.value}>{la.label}</option>}
                    </For>
                  </select>
                </div>
                <label class="flex items-center gap-1 text-xs text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={action.isRepeatable}
                    onChange={(e) => updateAction(index(), "isRepeatable", e.currentTarget.checked)}
                    class="rounded"
                  />
                  Repeat
                </label>
                <Show when={action.isRepeatable}>
                  <input
                    type="number"
                    value={action.maxRepeats ?? ""}
                    onInput={(e) => updateAction(index(), "maxRepeats", parseInt(e.currentTarget.value) || null)}
                    placeholder="max"
                    class="w-14 px-2 py-1 rounded bg-surface-elevated border border-surface-border text-xs text-center focus:outline-none focus:border-accent/50"
                  />
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving()}
        class={`w-full py-3 rounded-xl font-semibold text-white transition-colors ${
          saving() ? "bg-accent/50 cursor-not-allowed" : "bg-accent hover:bg-accent/90"
        }`}
      >
        {saving() ? "Creating..." : "Create Challenge"}
      </button>
    </div>
  );
}

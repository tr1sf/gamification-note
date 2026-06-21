import { createSignal, For, Show } from "solid-js";
import type { GuildMember } from "~/stores/guild";
import {
  createTask,
  submitTask,
  reviewTask,
  deleteTask,
  type GuildTask,
} from "~/stores/tasks";
import { addToast } from "~/stores/ui";
import Nelar from "~/components/mascot/Nelar";
import { t } from "~/lib/i18n";

interface GuildTasksProps {
  guildId: string;
  tasks: GuildTask[];
  members: GuildMember[];
  currentUserId?: string;
  canManage: boolean; // owner/admin
  onChanged: () => void | Promise<void>;
}

const STATUS_BADGE: Record<string, string> = {
  assigned: "bg-surface-border text-ink-secondary",
  submitted: "bg-xp/15 text-xp",
  approved: "bg-success-bg text-success",
};
const STATUS_LABEL: Record<string, string> = {
  assigned: t("Assigned"),
  submitted: t("In review"),
  approved: t("Approved"),
};

export default function GuildTasks(props: GuildTasksProps) {
  const [showCreate, setShowCreate] = createSignal(false);
  const [busy, setBusy] = createSignal<string | null>(null);

  // create form
  const [assigneeId, setAssigneeId] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [xpReward, setXpReward] = createSignal(50);
  const [coinReward, setCoinReward] = createSignal(10);
  const [dueAt, setDueAt] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const resetForm = () => {
    setAssigneeId(""); setTitle(""); setDescription(""); setXpReward(50); setCoinReward(10); setDueAt("");
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!assigneeId() || !title().trim()) {
      addToast(t("Pick an assignee and a title"), "error");
      return;
    }
    setSaving(true);
    const created = await createTask(props.guildId, {
      assigneeId: assigneeId(),
      title: title().trim(),
      description: description().trim() || undefined,
      xpReward: xpReward(),
      coinReward: coinReward(),
      dueAt: dueAt() ? new Date(dueAt()).toISOString() : undefined,
    });
    setSaving(false);
    if (created) {
      addToast(t("Task assigned"), "success");
      setShowCreate(false);
      resetForm();
      await props.onChanged();
    } else {
      addToast(t("Failed to create task"), "error");
    }
  };

  const handleSubmit = async (task: GuildTask) => {
    setBusy(task.id);
    const ok = await submitTask(props.guildId, task.id);
    setBusy(null);
    addToast(ok ? t("Submitted for review") : t("Failed to submit"), ok ? "success" : "error");
    if (ok) await props.onChanged();
  };

  const handleReview = async (task: GuildTask, decision: "approve" | "reject") => {
    let note: string | undefined;
    if (decision === "reject") {
      const input = prompt(t("Reason for sending back (optional):")) ?? "";
      note = input.trim() || undefined;
    }
    setBusy(task.id);
    const ok = await reviewTask(props.guildId, task.id, decision, note);
    setBusy(null);
    addToast(
      ok ? (decision === "approve" ? `${t("Task approved")} 🎉` : t("Sent back to assignee")) : t("Action failed"),
      ok ? (decision === "approve" ? "success" : "info") : "error"
    );
    if (ok) await props.onChanged();
  };

  const handleDelete = async (task: GuildTask) => {
    if (!confirm(`${t("Delete task")} "${task.title}"?`)) return;
    setBusy(task.id);
    const ok = await deleteTask(props.guildId, task.id);
    setBusy(null);
    if (ok) await props.onChanged();
    else addToast(t("Failed to delete task"), "error");
  };

  const isAssignee = (t: GuildTask) => t.assignee.id === props.currentUserId;
  const canDelete = (t: GuildTask) => props.canManage || t.creator.id === props.currentUserId;

  const dueLabel = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-ink-secondary">
          {props.tasks.length} {props.tasks.length === 1 ? t("task") : t("tasks")}
        </h2>
        <Show when={props.canManage}>
          <button
            onClick={() => setShowCreate(true)}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface-overlay rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            + {t("Assign task")}
          </button>
        </Show>
      </div>

      <Show
        when={props.tasks.length > 0}
        fallback={
          <div class="text-center py-12 text-ink-secondary">
            <Nelar state="idle" size={56} class="mx-auto mb-2" />
            <p class="text-sm">
              {props.canManage ? t("No tasks yet. Assign one to a guild member.") : t("No tasks assigned yet.")}
            </p>
          </div>
        }
      >
        <div class="space-y-2">
          <For each={props.tasks}>
            {(task) => (
              <div class="p-4 rounded-lg border border-surface-border bg-surface-elevated">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-semibold text-ink-primary">{task.title}</h3>
                      <span class={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[task.status]}`}>
                        {STATUS_LABEL[task.status]}
                      </span>
                    </div>
                    <Show when={task.description}>
                      <p class="text-sm text-ink-secondary mt-1">{task.description}</p>
                    </Show>
                    <div class="flex items-center gap-3 mt-2 text-xs text-ink-secondary flex-wrap">
                      <span>👤 {task.assignee.username}</span>
                      <Show when={task.xpReward > 0}><span class="text-xp font-semibold">+{task.xpReward} {t("XP")}</span></Show>
                      <Show when={task.coinReward > 0}><span class="text-coin font-semibold">+{task.coinReward} 🪙</span></Show>
                      <Show when={task.dueAt}><span>📅 {t("due")} {dueLabel(task.dueAt)}</span></Show>
                      <span>{t("by")} {task.creator.username}</span>
                    </div>
                    <Show when={task.status === "assigned" && task.reviewNote}>
                      <p class="text-xs text-error mt-2 bg-error-bg/40 rounded px-2 py-1">
                        ↩ {t("Sent back:")} {task.reviewNote}
                      </p>
                    </Show>
                  </div>

                  <Show when={canDelete(task)}>
                    <button
                      onClick={() => handleDelete(task)}
                      class="p-1.5 text-ink-secondary/60 hover:text-error transition-colors shrink-0"
                      title="Delete task"
                      aria-label="Delete task"
                    >
                      🗑
                    </button>
                  </Show>
                </div>

                {/* Actions */}
                <div class="flex items-center gap-2 mt-3">
                  <Show when={isAssignee(task) && task.status === "assigned"}>
                    <button
                      onClick={() => handleSubmit(task)}
                      disabled={busy() === task.id}
                      class="px-3 py-1.5 bg-accent text-surface-overlay rounded-md text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {t("Mark done")}
                    </button>
                  </Show>
                  <Show when={isAssignee(task) && task.status === "submitted"}>
                    <span class="text-xs text-ink-secondary">{t("Waiting for review…")}</span>
                  </Show>
                  <Show when={props.canManage && task.status === "submitted"}>
                    <button
                      onClick={() => handleReview(task, "approve")}
                      disabled={busy() === task.id}
                      class="px-3 py-1.5 bg-success text-surface-overlay rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {t("Approve")}
                    </button>
                    <button
                      onClick={() => handleReview(task, "reject")}
                      disabled={busy() === task.id}
                      class="px-3 py-1.5 border border-surface-border text-ink-secondary rounded-md text-xs font-medium hover:border-error hover:text-error transition-colors disabled:opacity-50"
                    >
                      {t("Send back")}
                    </button>
                  </Show>
                  <Show when={task.status === "approved"}>
                    <span class="text-xs text-success">✓ {t("Completed")}</span>
                  </Show>
                </div>
              </div>
            )}
          </For>
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
            <h2 class="font-display font-bold text-ink-primary text-lg">{t("Assign a task")}</h2>

            <div>
              <label for="task-assignee" class="block text-xs text-ink-secondary mb-1.5">{t("Assign to")}</label>
              <select
                id="task-assignee"
                value={assigneeId()}
                onChange={(e) => setAssigneeId(e.currentTarget.value)}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">{t("— Select a member —")}</option>
                <For each={props.members}>
                  {(m) => <option value={m.userId}>{m.user.username}{m.userId === props.currentUserId ? ` ${t("(you)")}` : ""}</option>}
                </For>
              </select>
            </div>

            <div>
              <label for="task-title" class="block text-xs text-ink-secondary mb-1.5">{t("Title")}</label>
              <input
                id="task-title"
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                maxLength={120}
                placeholder={t("e.g. Write the onboarding guide")}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label for="task-desc" class="block text-xs text-ink-secondary mb-1.5">{t("Details (optional)")}</label>
              <textarea
                id="task-desc"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                maxLength={1000}
                rows={3}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>

            <div class="flex gap-3">
              <div class="flex-1">
                <label for="task-xp" class="block text-xs text-ink-secondary mb-1.5">{t("XP reward")}</label>
                <input id="task-xp" type="number" min={0} max={500} value={xpReward()}
                  onInput={(e) => setXpReward(parseInt(e.currentTarget.value) || 0)}
                  class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div class="flex-1">
                <label for="task-coins" class="block text-xs text-ink-secondary mb-1.5">{t("Coin reward")}</label>
                <input id="task-coins" type="number" min={0} max={200} value={coinReward()}
                  onInput={(e) => setCoinReward(parseInt(e.currentTarget.value) || 0)}
                  class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>

            <div>
              <label for="task-due" class="block text-xs text-ink-secondary mb-1.5">{t("Due date (optional)")}</label>
              <input id="task-due" type="date" value={dueAt()}
                onInput={(e) => setDueAt(e.currentTarget.value)}
                class="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>

            <div class="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} class="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary">
                {t("Cancel")}
              </button>
              <button type="submit" disabled={saving()}
                class="px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
                {saving() ? t("Assigning...") : t("Assign task")}
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}

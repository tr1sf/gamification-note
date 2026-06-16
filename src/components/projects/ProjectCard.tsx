import { createResource, createSignal, For, Show } from "solid-js";
import { authFetch, user as authUser } from "~/stores/auth";
import { addToast, showReward } from "~/stores/ui";
import { applyReward } from "~/stores/user";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  order: number;
  completed: boolean;
  completedAt: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  milestones: Milestone[];
}

async function fetchProjects(): Promise<Project[]> {
  const res = await authFetch("/api/projects");
  const json = await res.json();
  return json.success ? json.data : [];
}

export default function ProjectList() {
  const [projects, { refetch }] = createResource(fetchProjects);
  const [newTitle, setNewTitle] = createSignal("");
  const [createLoading, setCreateLoading] = createSignal(false);

  const createProject = async () => {
    const title = newTitle().trim();
    if (!title) return;
    setCreateLoading(true);
    const res = await authFetch("/api/projects", {
      method: "POST",
      body: JSON.stringify({ title }),
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (json.success) {
      setNewTitle("");
      refetch();
    } else {
      addToast("Failed to create project", "error");
    }
    setCreateLoading(false);
  };

  const toggleMilestone = async (projectId: string, milestone: Milestone) => {
    const res = await authFetch(`/api/projects/${projectId}/milestones?milestoneId=${milestone.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: !milestone.completed }),
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (json.success) {
      refetch();
      if (!milestone.completed) {
        showReward({ message: `Milestone complete: ${milestone.title}`, xp: 10, coins: 5 });
      }
    }
  };

  const addMilestone = async (projectId: string) => {
    const title = prompt("Milestone title:");
    if (!title?.trim()) return;
    const res = await authFetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      body: JSON.stringify({ title: title.trim() }),
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (json.success) {
      refetch();
    } else {
      addToast("Failed to add milestone", "error");
    }
  };

  return (
    <div class="bg-surface-elevated rounded-xl p-5 border border-surface-border">
      <h3 class="text-sm font-semibold text-ink-primary mb-3">Projects & Milestones</h3>

      <div class="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="New project..."
          value={newTitle()}
          onInput={(e) => setNewTitle(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") createProject(); }}
          class="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-sm text-ink-primary placeholder:text-ink-secondary/40"
        />
        <button
          onClick={createProject}
          disabled={createLoading() || !newTitle().trim()}
          class="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <Show when={projects()?.length} fallback={<p class="text-xs text-ink-secondary/60">No projects yet</p>}>
        <div class="space-y-3">
          <For each={projects()}>
            {(project) => {
              const totalMilestones = () => project.milestones.length;
              const completedMilestones = () => project.milestones.filter((m) => m.completed).length;
              const progressPct = () =>
                totalMilestones() === 0 ? 0 : Math.round((completedMilestones() / totalMilestones()) * 100);

              return (
                <div class="border border-surface-border rounded-lg p-3">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-medium text-ink-primary">{project.title}</h4>
                    <span class="text-xs text-ink-secondary/60">
                      {completedMilestones()}/{totalMilestones()}
                    </span>
                  </div>
                  <div class="h-1.5 rounded-full bg-surface overflow-hidden mb-2">
                    <div
                      class="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${progressPct()}%` }}
                    />
                  </div>
                  <Show when={project.milestones.length > 0}>
                    <div class="space-y-1 mb-2">
                      <For each={project.milestones}>
                        {(m) => (
                          <button
                            onClick={() => toggleMilestone(project.id, m)}
                            class={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
                              m.completed
                                ? "text-ink-secondary/40 line-through"
                                : "text-ink-primary hover:bg-surface-hover"
                            }`}
                          >
                            <span>{m.completed ? "✓" : "○"}</span>
                            {m.title}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                  <button
                    onClick={() => addMilestone(project.id)}
                    class="text-xs text-accent/60 hover:text-accent transition-colors"
                  >
                    + Add milestone
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

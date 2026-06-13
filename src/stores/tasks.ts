import { authFetch } from "~/stores/auth";

export type TaskStatus = "assigned" | "submitted" | "approved";

export interface TaskUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface GuildTask {
  id: string;
  guildId: string;
  title: string;
  description: string | null;
  xpReward: number;
  coinReward: number;
  dueAt: string | null;
  status: TaskStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  creator: TaskUser;
  assignee: TaskUser;
}

export async function fetchTasks(guildId: string): Promise<GuildTask[]> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/tasks`);
    const json = await res.json();
    return json.success ? (json.data?.items ?? []) : [];
  } catch {
    return [];
  }
}

export async function createTask(
  guildId: string,
  data: { assigneeId: string; title: string; description?: string; xpReward?: number; coinReward?: number; dueAt?: string }
): Promise<GuildTask | null> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function submitTask(guildId: string, taskId: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/tasks/${taskId}/submit`, { method: "POST" });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function reviewTask(
  guildId: string,
  taskId: string,
  decision: "approve" | "reject",
  reviewNote?: string
): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/tasks/${taskId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reviewNote }),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function deleteTask(guildId: string, taskId: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/tasks/${taskId}`, { method: "DELETE" });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

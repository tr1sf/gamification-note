import { authFetch } from "~/stores/auth";

export interface Habit {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  xpReward: number;
  coinReward: number;
  bestStreak: number;
  currentStreak: number;
  completedToday: boolean;
  createdAt: string;
}

export interface CheckinResult {
  currentStreak: number;
  bestStreak: number;
  completedToday: boolean;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
}

export async function fetchHabits(): Promise<Habit[]> {
  try {
    const res = await authFetch("/api/habits");
    const json = await res.json();
    return json.success ? (json.data?.items ?? []) : [];
  } catch {
    return [];
  }
}

export async function createHabit(data: {
  title: string;
  description?: string;
  icon?: string;
  xpReward?: number;
  coinReward?: number;
}): Promise<Habit | null> {
  try {
    const res = await authFetch("/api/habits", {
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

export async function updateHabit(
  id: string,
  data: Partial<{ title: string; description: string; icon: string; xpReward: number; coinReward: number; isArchived: boolean }>
): Promise<boolean> {
  try {
    const res = await authFetch(`/api/habits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function deleteHabit(id: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/habits/${id}`, { method: "DELETE" });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function checkinHabit(id: string): Promise<CheckinResult | null> {
  try {
    const res = await authFetch(`/api/habits/${id}/checkin`, { method: "POST" });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

import { createSignal } from "solid-js";
import { authFetch } from "~/stores/auth";

export interface Quest {
  id: string;
  title: string;
  description: string;
  questType: string;
  icon: string;
  criteria: any;
  xpReward: number;
  coinReward: number;
  progress?: { current: number };
  status?: string;
}

const [quests, setQuests] = createSignal<Quest[]>([]);
const [questsLoading, setQuestsLoading] = createSignal(false);

export { quests, questsLoading };

export async function fetchActiveQuests() {
  setQuestsLoading(true);
  try {
    const res = await authFetch("/api/quests/active");
    const json = await res.json();
    if (json.success) {
      setQuests(json.data || []);
    }
  } catch {
    setQuests([]);
  } finally {
    setQuestsLoading(false);
  }
}

export async function claimQuest(questId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await authFetch(`/api/quests/${questId}/claim`, { method: "POST" });
    const json = await res.json();
    if (json.success) {
      setQuests((prev) =>
        prev.map((q) => (q.id === questId ? { ...q, status: "claimed" } : q))
      );
      return { success: true, data: json.data };
    }
    return { success: false, error: json.error?.message || "Failed to claim reward" };
  } catch {
    return { success: false, error: "Network error" };
  }
}

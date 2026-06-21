import { createSignal } from "solid-js";
import { authFetch } from "~/stores/auth";
import type { EquippedCosmetics } from "~/lib/cosmetics/equipped";

export interface Guild {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  inviteCode?: string; // only returned to owner/admin
  memberCount: number;
  maxMembers?: number;
  isMember?: boolean;
  createdAt: string;
  ownerId: string;
  owner?: { id: string; username: string };
  role?: "owner" | "admin" | "member";
}

export interface GuildNote {
  id: string;
  title: string;
  excerpt: string;
  category: string | null;
  tags: string[];
  wordCount: number;
  isPublic: boolean;
  updatedAt: string;
  author: { id: string; username: string };
}

export interface GuildMember {
  id: string;
  userId: string;
  guildId: string;
  role: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    level: number;
    title: string;
    equipped?: EquippedCosmetics;
  };
}

export interface GuildGoal {
  id: string;
  guildId: string;
  title: string;
  description: string | null;
  targetCount: number;
  currentCount: number;
  startDate: string;
  endDate: string;
  rewardXp: number;
  rewardCoins: number;
  isCompleted: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  guildId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    equipped?: EquippedCosmetics;
  };
  type?: "message" | "system";
  reactions?: { emoji: string; userId: string; createdAt: string }[];
}

const [guilds, setGuilds] = createSignal<Guild[]>([]);
const [currentGuild, setCurrentGuild] = createSignal<Guild | null>(null);
const [members, setMembers] = createSignal<GuildMember[]>([]);
const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
const [loading, setLoading] = createSignal(false);

export { guilds, currentGuild, members, chatMessages, loading };

export async function fetchGuilds(cursor?: string): Promise<Guild[]> {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    params.set("take", "20");
    const res = await authFetch(`/api/guilds?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      const data = json.data?.items || [];
      const guilds = data.map((g: any) => ({
        ...g,
        memberCount: g._count?.members ?? 0,
      }));
      setGuilds(guilds);
      return guilds;
    }
    return [];
  } catch {
    return [];
  } finally {
    setLoading(false);
  }
}

export async function fetchGuild(id: string): Promise<Guild | null> {
  setLoading(true);
  try {
    const res = await authFetch(`/api/guilds/${id}`);
    const json = await res.json();
    if (json.success) {
      const guild: Guild = {
        ...json.data,
        memberCount: json.data._count?.members ?? json.data.memberCount ?? 0,
      };
      setCurrentGuild(guild);
      return guild;
    }
    return null;
  } catch {
    return null;
  } finally {
    setLoading(false);
  }
}

export async function fetchMembers(guildId: string): Promise<GuildMember[]> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/members`);
    const json = await res.json();
    if (json.success) {
      const data = json.data?.items || json.data || [];
      setMembers(data);
      return data;
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchMessages(guildId: string, cursor?: string): Promise<ChatMessage[]> {
  try {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    const res = await authFetch(`/api/guilds/${guildId}/messages${qs ? `?${qs}` : ""}`);
    const json = await res.json();
    if (json.success) {
      const msgs = (json.data?.items || []).sort(
        (a: ChatMessage, b: ChatMessage) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setChatMessages((prev) => (cursor ? [...msgs, ...prev] : msgs));
      return msgs;
    }
    return [];
  } catch {
    return [];
  }
}

export async function createGuild(data: { name: string; description: string; isPublic: boolean }): Promise<Guild | null> {
  try {
    const res = await authFetch("/api/guilds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
      setGuilds((prev) => [json.data, ...prev]);
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function joinGuild(guildId: string, inviteCode?: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteCode ? { inviteCode } : {}),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function leaveGuild(guildId: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/leave`, { method: "POST" });
    const json = await res.json();
    if (json.success) {
      setGuilds((prev) => prev.filter((g) => g.id !== guildId));
    }
    return json.success;
  } catch {
    return false;
  }
}

export async function deleteGuild(guildId: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setGuilds((prev) => prev.filter((g) => g.id !== guildId));
    }
    return json.success;
  } catch {
    return false;
  }
}

export async function regenerateInvite(guildId: string): Promise<string | null> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/invite`, { method: "POST" });
    const json = await res.json();
    return json.success ? (json.data?.inviteCode ?? null) : null;
  } catch {
    return null;
  }
}

export async function updateMemberRole(
  guildId: string,
  userId: string,
  role: "owner" | "admin" | "member"
): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function kickMember(guildId: string, userId: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/members/${userId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function fetchGuildNotes(guildId: string): Promise<GuildNote[]> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/notes`);
    const json = await res.json();
    return json.success ? (json.data?.items ?? []) : [];
  } catch {
    return [];
  }
}

export async function shareNoteToGuild(guildId: string, noteId: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function unshareNoteFromGuild(guildId: string, noteId: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/notes/${noteId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

export async function fetchGoals(guildId: string): Promise<GuildGoal[]> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/goals`);
    const json = await res.json();
    return json.success ? (json.data ?? []) : [];
  } catch {
    return [];
  }
}

export async function createGoal(
  guildId: string,
  data: {
    title: string;
    description?: string;
    targetCount: number;
    startDate?: string;
    endDate: string;
    rewardXp?: number;
    rewardCoins?: number;
  }
): Promise<GuildGoal | null> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/goals`, {
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

export async function contributeGoal(
  guildId: string,
  goalId: string
): Promise<{ currentCount: number; isCompleted: boolean } | null> {
  try {
    const res = await authFetch(`/api/guilds/${guildId}/goals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId }),
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export function addSocketMessage(message: ChatMessage) {
  setChatMessages((prev) => [...prev, message]);
}

export function updateMemberInList(memberData: GuildMember) {
  setMembers((prev) => [...prev, memberData]);
}

export function removeMemberFromList(userId: string) {
  setMembers((prev) => prev.filter((m) => m.userId !== userId));
}

import { createSignal } from "solid-js";
import { authFetch } from "~/stores/auth";

export interface DMConversation {
  id: string;
  name?: string;
  type: "direct" | "group";
  members: { id: string; username: string; avatarUrl: string | null }[];
  lastMessage?: { content: string; createdAt: string } | null;
}

export interface DMMessage {
  id: string;
  senderId: string;
  groupId: string;
  content: string;
  sender?: { id: string; username: string; avatarUrl: string | null };
  createdAt: string;
}

const [conversations, setConversations] = createSignal<DMConversation[]>([]);
const [currentConversation, setCurrentConversation] = createSignal<DMConversation | null>(null);
const [dmMessages, setDmMessages] = createSignal<DMMessage[]>([]);

export { conversations, currentConversation, dmMessages };

export async function fetchConversations(): Promise<DMConversation[]> {
  try {
    const res = await authFetch("/api/dms");
    const json = await res.json();
    if (json.success) {
      setConversations(json.data);
      return json.data;
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchDMMessages(groupId: string): Promise<DMMessage[]> {
  try {
    const res = await authFetch(`/api/dms/${groupId}`);
    const json = await res.json();
    if (json.success) {
      setDmMessages(json.data);
      return json.data;
    }
    return [];
  } catch {
    return [];
  }
}

export async function sendDM(receiverId: string, content: string): Promise<{ message: DMMessage; groupId: string } | null> {
  try {
    const res = await authFetch("/api/dms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId, content }),
    });
    const json = await res.json();
    if (json.success) {
      setDmMessages((prev) => [...prev, json.data.message]);
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendDMToGroup(groupId: string, content: string): Promise<{ message: DMMessage; groupId: string } | null> {
  try {
    const res = await authFetch("/api/dms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, content }),
    });
    const json = await res.json();
    if (json.success) {
      setDmMessages((prev) => [...prev, json.data.message]);
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createGroupDM(name: string, memberIds: string[]): Promise<string | null> {
  try {
    const res = await authFetch("/api/dms/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, memberIds }),
    });
    const json = await res.json();
    return json.success ? json.data.id : null;
  } catch {
    return null;
  }
}

export function addSocketDMMessage(message: DMMessage) {
  setDmMessages((prev) => [...prev, message]);
}

export async function startDirectConversation(receiverId: string): Promise<string | null> {
  try {
    const res = await authFetch("/api/dms/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [receiverId] }),
    });
    const json = await res.json();
    return json.success ? json.data.id : null;
  } catch {
    return null;
  }
}
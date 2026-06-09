import { createSignal } from "solid-js";
import { authFetch } from "~/stores/auth";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

const [notifications, setNotifications] = createSignal<Notification[]>([]);
const [unreadCount, setUnreadCount] = createSignal(0);

export { notifications, unreadCount };

export async function fetchNotifications(): Promise<Notification[]> {
  try {
    const res = await authFetch("/api/notifications");
    const json = await res.json();
    if (json.success) {
      const data = (json.data || []) as Notification[];
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
      return data;
    }
    return [];
  } catch {
    return [];
  }
}

export async function markRead(id: string): Promise<boolean> {
  try {
    const res = await authFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    const json = await res.json();
    if (json.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    return json.success;
  } catch {
    return false;
  }
}

export async function markAllRead(): Promise<boolean> {
  try {
    const res = await authFetch("/api/notifications/read-all", { method: "PATCH" });
    const json = await res.json();
    if (json.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
    return json.success;
  } catch {
    return false;
  }
}

export function addSocketNotification(notification: Notification) {
  setNotifications((prev) => [notification, ...prev]);
  if (!notification.isRead) {
    setUnreadCount((prev) => prev + 1);
  }
}

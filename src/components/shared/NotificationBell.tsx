import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { notifications, unreadCount, fetchNotifications, markRead, markAllRead, addSocketNotification, type Notification } from "~/stores/notifications";
import { useSocket } from "~/lib/socket/client";

export default function NotificationBell() {
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  const navigate = useNavigate();
  const { on, off } = useSocket();
  let dropdownRef: HTMLDivElement | undefined;

  onMount(async () => {
    await fetchNotifications();
    setLoaded(true);

    const handleNewNotification = (notification: Notification) => {
      addSocketNotification(notification);
    };
    on("notification:new", handleNewNotification);

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);

    onCleanup(() => {
      off("notification:new", handleNewNotification);
      document.removeEventListener("click", handleClickOutside);
    });
  });

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markRead(notification.id);
    }
    setDropdownOpen(false);
    if (notification.data?.url) {
      navigate(notification.data.url as string);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  const iconByType = (type: string) => {
    switch (type) {
      case "guild_invite":
        return "🏛️";
      case "guild_mention":
        return "💬";
      case "level_up":
        return "⬆️";
      case "achievement":
        return "🏆";
      case "quest_complete":
        return "✅";
      case "reward":
        return "🎁";
      default:
        return "🔔";
    }
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div class="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        class="relative p-1.5 text-ink-secondary hover:text-ink-primary transition-colors"
        aria-label={`Notifications${unreadCount() > 0 ? `, ${unreadCount()} unread` : ""}`}
      >
        <span aria-hidden="true" class="text-lg">🔔</span>
        <Show when={unreadCount() > 0}>
          <span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-error text-white text-[10px] font-bold px-1">
            {unreadCount() > 99 ? "99+" : unreadCount()}
          </span>
        </Show>
      </button>

      <Show when={dropdownOpen()}>
        <div class="absolute right-0 mt-2 w-80 bg-surface-elevated border border-surface-border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden flex flex-col">
          <div class="flex items-center justify-between p-3 border-b border-surface-border">
            <span class="text-sm font-medium text-ink-primary">Notifications</span>
            <Show when={unreadCount() > 0}>
              <button
                onClick={handleMarkAllRead}
                class="text-xs text-accent hover:underline"
              >
                Mark all read
              </button>
            </Show>
          </div>

          <div class="flex-1 overflow-y-auto">
            <Show
              when={loaded() && notifications().length > 0}
              fallback={
                <div class="text-center py-8 text-ink-secondary">
                  <Show
                    when={loaded()}
                    fallback={<p class="text-sm animate-pulse">Loading...</p>}
                  >
                    <p class="text-3xl mb-2">🔔</p>
                    <p class="text-sm">No notifications yet</p>
                  </Show>
                </div>
              }
            >
              <For each={notifications().slice(0, 50)}>
                {(notification) => (
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    class={`w-full text-left p-3 flex gap-3 hover:bg-surface-hover transition-colors border-b border-surface-border/50 ${
                      !notification.isRead ? "bg-accent/5" : ""
                    }`}
                  >
                    <span aria-hidden="true" class="text-lg shrink-0 mt-0.5">
                      {iconByType(notification.type)}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-ink-primary truncate">
                          {notification.title}
                        </span>
                        <Show when={!notification.isRead}>
                          <span class="w-2 h-2 rounded-full bg-accent shrink-0" />
                        </Show>
                      </div>
                      <p class="text-xs text-ink-secondary mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                      <span class="text-xs text-ink-secondary mt-1 block">
                        {timeAgo(notification.createdAt)}
                      </span>
                    </div>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

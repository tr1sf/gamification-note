import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";

interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  toasts: Array<{ id: string; message: string; type: "success" | "error" | "info" }>;
}

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  // Default to the dark tavern theme unless the user explicitly chose light.
  return "dark";
}

const [uiStore, setUIStore] = createStore<UIState>({
  sidebarOpen: false,
  theme: getInitialTheme(),
  toasts: [],
});

// Set initial data-theme before first paint
if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-theme", uiStore.theme);
}

export { uiStore };

export function toggleSidebar() {
  setUIStore("sidebarOpen", (v) => !v);
}

export function setTheme(theme: "light" | "dark") {
  setUIStore("theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

let toastId = 0;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function addToast(message: string, type: "success" | "error" | "info" = "info") {
  const id = String(++toastId);
  setUIStore("toasts", (t) => [...t, { id, message, type }]);

  // Clear any existing timer for this id
  const existing = toastTimers.get(id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    setUIStore("toasts", (t) => t.filter((x) => x.id !== id));
    toastTimers.delete(id);
  }, 3500);
  toastTimers.set(id, timer);
}

export function dismissToast(id: string) {
  const timer = toastTimers.get(id);
  if (timer) clearTimeout(timer);
  toastTimers.delete(id);
  setUIStore("toasts", (t) => t.filter((x) => x.id !== id));
}

export interface RewardEntry {
  id: string;
  message?: string;
  xp?: number;
  coins?: number;
  achievement?: string;
  leveledUp?: boolean;
  newLevel?: number;
  newTitle?: string;
}

export const [rewardQueue, setRewardQueue] = createSignal<RewardEntry[]>([]);

let rewardIdCounter = 0;

export function showReward(reward: Omit<RewardEntry, "id">) {
  const id = `reward-${++rewardIdCounter}`;
  const entry: RewardEntry = { id, ...reward };
  setRewardQueue((prev) => [...prev, entry]);
  setTimeout(() => {
    setRewardQueue((prev) => prev.filter((r) => r.id !== id));
  }, 3500);
  return id;
}

import { createSignal } from "solid-js";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  coins: number;
  streak: number;
  title: string;
  role: string;
  createdAt: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
}

const [currentUser, setUser] = createSignal<AuthUser | null>(null);
const [loading, setLoading] = createSignal(true);

export { currentUser as user, loading };

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await authFetch("/api/auth/me");
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function initAuth() {
  setLoading(true);
  try {
    const u = await fetchMe();
    setUser(u);
  } finally {
    setLoading(false);
  }
}

export async function login(email: string, password: string): Promise<{ user?: AuthUser; error?: AuthError }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!json.success) return { error: json.error };
    setUser(json.data);
    return { user: json.data };
  } catch {
    return { error: { code: "NETWORK", message: "Network error. Please try again." } };
  }
}

export async function register(email: string, username: string, password: string): Promise<{ user?: AuthUser; error?: AuthError }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, username, password }),
    });
    const json = await res.json();
    if (!json.success) return { error: json.error };
    setUser(json.data);
    return { user: json.data };
  } catch {
    return { error: { code: "NETWORK", message: "Network error. Please try again." } };
  }
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } finally {
    setUser(null);
  }
}

export async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const requestUrl = (typeof window === "undefined" && !url.startsWith("http"))
    ? `http://localhost:${process.env.PORT || "3000"}${url}`
    : url;
  let res = await fetch(requestUrl, { ...options, credentials: "include" });
  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      res = await fetch(requestUrl, { ...options, credentials: "include" });
    } else {
      setUser(null);
      throw new Error("SESSION_EXPIRED");
    }
  }
  return res;
}

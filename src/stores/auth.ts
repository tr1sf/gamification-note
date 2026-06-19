import { createSignal } from "solid-js";
import { applyLanguage } from "~/lib/i18n";

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
  gamificationStyle?: string;
  path?: string | null;
  onboardingCompleted?: boolean;
  preferredLanguage?: string;
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

function applyUserLanguage(user: AuthUser | null) {
  if (user?.preferredLanguage && typeof localStorage !== "undefined") {
    applyLanguage(user.preferredLanguage as "en" | "vi");
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await authFetch("/api/auth/me");
    if (!res.ok) return null;
    const json = await res.json();
    if (json.data) {
      setUser(json.data);
      applyUserLanguage(json.data);
    }
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

// Reads an auth response, distinguishing real network failures (fetch rejects)
// from server errors that return a non-JSON body (e.g. a 500 HTML error page).
async function readAuthResponse(
  res: Response,
): Promise<{ user?: AuthUser; error?: AuthError }> {
  let json: { success?: boolean; data?: AuthUser; error?: AuthError } | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!json) {
    return {
      error: {
        code: "SERVER_ERROR",
        message: `Server returned an unexpected response (HTTP ${res.status}). Please try again.`,
      },
    };
  }
  if (!json.success) {
    return { error: json.error ?? { code: "SERVER_ERROR", message: `Request failed (HTTP ${res.status}).` } };
  }
  setUser(json.data!);
  applyUserLanguage(json.data!);
  return { user: json.data };
}

export async function login(email: string, password: string): Promise<{ user?: AuthUser; error?: AuthError }> {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login: email, password }),
    });
  } catch {
    return { error: { code: "NETWORK", message: "Can't reach the server. Check your connection and try again." } };
  }
  return readAuthResponse(res);
}

export async function register(email: string, username: string, password: string): Promise<{ user?: AuthUser; error?: AuthError }> {
  let res: Response;
  const preferredLanguage = (typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null) || "en";
  try {
    res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, username, password, preferredLanguage }),
    });
  } catch {
    return { error: { code: "NETWORK", message: "Can't reach the server. Check your connection and try again." } };
  }
  // Clear theme from previous user session
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("equippedTheme");
    localStorage.removeItem("equippedThemeId");
    localStorage.removeItem("equippedThemeActive");
  }
  return readAuthResponse(res);
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } finally {
    setUser(null);
    if (typeof localStorage !== "undefined") {
      // Reset public/session state to defaults; language is account-specific.
      localStorage.setItem("lang", "en");
      localStorage.removeItem("equippedTheme");
      localStorage.removeItem("equippedThemeId");
      localStorage.removeItem("equippedThemeActive");
      document.documentElement.setAttribute("lang", "en");
    }
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

import { track } from "./tracker";

const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const sessions = new Map<string, { sessionId: string; lastActivity: number }>();

export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function startSession(
  userId: string,
  device: "desktop" | "mobile" | "tablet" = "desktop",
): Promise<string> {
  const existing = sessions.get(userId);
  if (existing) {
    const idleDuration = Date.now() - existing.lastActivity;
    if (idleDuration >= SESSION_IDLE_TIMEOUT) {
      // Old session expired, end it
      await track({
        userId,
        actionType: "session_end",
        metadata: { sessionId: existing.sessionId, duration: Math.round(idleDuration / 1000), device },
      });
      sessions.delete(userId);
    } else {
      // Still active, update lastActivity
      existing.lastActivity = Date.now();
      return existing.sessionId;
    }
  }

  const sessionId = generateSessionId();
  sessions.set(userId, { sessionId, lastActivity: Date.now() });

  await track({
    userId,
    actionType: "session_start",
    metadata: { sessionId, device },
  });

  return sessionId;
}

export async function endSession(userId: string): Promise<void> {
  const existing = sessions.get(userId);
  if (!existing) return;

  const duration = Math.round((Date.now() - existing.lastActivity) / 1000);
  await track({
    userId,
    actionType: "session_end",
    metadata: { sessionId: existing.sessionId, duration },
  });

  sessions.delete(userId);
}

export async function trackPageView(
  userId: string,
  page: string,
  tab?: string,
): Promise<void> {
  const existing = sessions.get(userId);
  const sessionId = existing?.sessionId;

  await track({
    userId,
    actionType: "page_view",
    metadata: { sessionId, page, tab },
  });

  if (existing) {
    existing.lastActivity = Date.now();
  }
}

export function getSessionId(userId: string): string | undefined {
  return sessions.get(userId)?.sessionId;
}

// Background cleanup: end sessions that have been idle too long
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.lastActivity >= SESSION_IDLE_TIMEOUT) {
      track({
        userId,
        actionType: "session_end",
        metadata: { sessionId: session.sessionId, duration: Math.round(SESSION_IDLE_TIMEOUT / 1000) },
      }).catch(() => {});
      sessions.delete(userId);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

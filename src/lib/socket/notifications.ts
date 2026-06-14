import type { Prisma } from "@prisma/client";
import { prisma } from "~/lib/db";
import { getIO } from "./index";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const urgency = (metadata?.urgency as string) || undefined;
  const expiresAt = (metadata?.expiresAt as string) ? new Date(metadata?.expiresAt as string) : undefined;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      ...(urgency ? { urgency } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    },
    select: {
      id: true, type: true, title: true, body: true,
      metadata: true, isRead: true, createdAt: true,
      urgency: true, expiresAt: true,
    },
  });

  try {
    const io = getIO();
    // Emit the full persisted notification so the client can render/track it
    // (id for mark-as-read, isRead/createdAt for display).
    io.to(`user:${userId}`).emit("notification:new", {
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch {
    // Socket.io not initialized yet or user not connected — notification still persisted
  }
}

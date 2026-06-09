import { prisma } from "~/lib/db";
import { getIO } from "./index";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      metadata: metadata ?? {},
    },
  });

  try {
    const io = getIO();
    io.to(`user:${userId}`).emit("notification:new", { type, title, body });
  } catch {
    // Socket.io not initialized yet or user not connected — notification still persisted
  }
}

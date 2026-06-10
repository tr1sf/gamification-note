import type { Server, Socket } from "socket.io";
import { prisma } from "~/lib/db";
import { getIO } from "./index";

const guildMessageRateLimit = new Map<string, number[]>();
const noteEditingLocks = new Map<string, { userId: string; expiresAt: number }>();

const EDIT_LOCK_TTL = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW = 10000;

function pruneRateLimitMap(): void {
  const now = Date.now();
  for (const [key, timestamps] of guildMessageRateLimit.entries()) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) guildMessageRateLimit.delete(key);
    else guildMessageRateLimit.set(key, recent);
  }
}

function pruneEditingLocks(): void {
  const now = Date.now();
  for (const [noteId, lock] of noteEditingLocks.entries()) {
    if (now > lock.expiresAt) noteEditingLocks.delete(noteId);
  }
}

setInterval(pruneRateLimitMap, 30000);
setInterval(pruneEditingLocks, 30000);

function checkGuildMessageRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 10000;
  const maxMessages = 10;
  const timestamps = guildMessageRateLimit.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= maxMessages) {
    guildMessageRateLimit.set(userId, recent);
    return false;
  }
  recent.push(now);
  guildMessageRateLimit.set(userId, recent);
  return true;
}

function cleanupEditingLocksForUser(userId: string): void {
  for (const [noteId, lock] of noteEditingLocks.entries()) {
    if (lock.userId === userId) {
      noteEditingLocks.delete(noteId);
      try {
        const io = getIO();
        io.to(`note:${noteId}`).emit("note:editing-ended", { userId });
      } catch {}
    }
  }
}

export function registerHandlers(socket: Socket): void {
  const userId = socket.data.userId as string;
  const username = socket.data.username as string;

  socket.on("guild:join", async ({ guildId }: { guildId: string }) => {
    if (!guildId) {
      socket.emit("error", { code: "INVALID_INPUT", message: "guildId is required" });
      return;
    }
    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!member) {
      socket.emit("error", { code: "NOT_MEMBER", message: "You are not a member of this guild" });
      return;
    }
    const room = `guild:${guildId}`;
    socket.join(room);
    socket.to(room).emit("guild:user-joined", { userId, username });
  });

  socket.on("guild:leave", ({ guildId }: { guildId: string }) => {
    if (!guildId) return;
    const room = `guild:${guildId}`;
    socket.leave(room);
    socket.to(room).emit("guild:user-left", { userId, username });
  });

  socket.on(
    "guild:send-message",
    async ({ guildId, content }: { guildId: string; content: string }) => {
      if (!content || typeof content !== "string" || content.length > 2000) {
        socket.emit("error", {
          code: "INVALID_MESSAGE",
          message: "Message must be 1-2000 characters",
        });
        return;
      }
      if (!guildId) {
        socket.emit("error", { code: "INVALID_INPUT", message: "guildId is required" });
        return;
      }
      if (!checkGuildMessageRateLimit(userId)) {
        socket.emit("error", {
          code: "RATE_LIMITED",
          message: "Too many messages. Please slow down.",
        });
        return;
      }
      const member = await prisma.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });
      if (!member) {
        socket.emit("error", {
          code: "NOT_MEMBER",
          message: "You are not a member of this guild",
        });
        return;
      }
      const message = await prisma.guildMessage.create({
        data: { guildId, userId, content },
      });
      const io = getIO();
      io.to(`guild:${guildId}`).emit("guild:message", {
        id: message.id,
        guildId,
        user: { id: userId, username },
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      });
    }
  );

  socket.on("note:join", async ({ noteId }: { noteId: string }) => {
    if (!noteId) return;
    // Mirror the REST access rule (api/notes/[id].ts): only the owner or a
    // public note may be joined — otherwise presence/editing activity of a
    // private note leaks to any authenticated user.
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { userId: true, isPublic: true, isDeleted: true },
    });
    if (!note || note.isDeleted) {
      socket.emit("error", { code: "NOT_FOUND", message: "Note not found" });
      return;
    }
    if (!note.isPublic && note.userId !== userId) {
      socket.emit("error", { code: "FORBIDDEN", message: "Access denied" });
      return;
    }
    const room = `note:${noteId}`;
    socket.join(room);
    socket.to(room).emit("note:user-joined", { userId, username });
  });

  socket.on("note:leave", ({ noteId }: { noteId: string }) => {
    if (!noteId) return;
    const room = `note:${noteId}`;
    socket.leave(room);
    socket.to(room).emit("note:user-left", { userId, username });
  });

  socket.on("note:editing-start", async ({ noteId }: { noteId: string }) => {
    if (!noteId) return;
    // Only the note's owner may acquire the edit lock — otherwise any user
    // could lock someone else's note for the full TTL (DoS) or signal a
    // phantom editor on a public note.
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { userId: true, isDeleted: true },
    });
    if (!note || note.isDeleted || note.userId !== userId) {
      socket.emit("error", { code: "FORBIDDEN", message: "Access denied" });
      return;
    }
    const lock = noteEditingLocks.get(noteId);
    if (lock && lock.userId !== userId && Date.now() < lock.expiresAt) {
      socket.emit("error", {
        code: "NOTE_LOCKED",
        message: "This note is currently being edited by another user",
      });
      return;
    }
    noteEditingLocks.set(noteId, { userId, expiresAt: Date.now() + EDIT_LOCK_TTL });
    socket.to(`note:${noteId}`).emit("note:editing-started", { userId, username });
  });

  socket.on("note:editing-end", ({ noteId }: { noteId: string }) => {
    if (!noteId) return;
    const lock = noteEditingLocks.get(noteId);
    if (lock && lock.userId === userId) {
      noteEditingLocks.delete(noteId);
    }
    socket.to(`note:${noteId}`).emit("note:editing-ended", { userId });
  });

  socket.on("disconnect", () => {
    cleanupEditingLocksForUser(userId);
  });
}

import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

type RouteCtx = { request: Request; params: { id: string; noteId: string } };

// DELETE — unshare a scroll from the guild. Allowed for the note's author,
// or the guild's owner/admin (moderation). Sets the note's guildId back to null;
// the note itself is never deleted.
export async function DELETE({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const note = await prisma.note.findUnique({
    where: { id: params.noteId },
    select: { id: true, userId: true, guildId: true },
  });
  if (!note || note.guildId !== params.id) {
    return error("NOT_FOUND", "Scroll is not shared with this guild", 404);
  }

  if (note.userId !== user.userId) {
    const membership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: params.id, userId: user.userId } },
      select: { role: true },
    });
    const isModerator = membership?.role === "owner" || membership?.role === "admin";
    if (!isModerator) {
      return error("FORBIDDEN", "Only the author or a guild moderator can unshare this scroll", 403);
    }
  }

  await prisma.note.update({
    where: { id: params.noteId },
    data: { guildId: null },
  });

  return success(null);
}

import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quest = await prisma.aIQuest.findUnique({ where: { id: params.id } });
  if (!quest || quest.userId !== user.userId) return error("NOT_FOUND", "Quest not found", 404);
  if (quest.status !== "active") return error("INVALID_STATE", "Quest not active", 400);

  await prisma.aIQuest.update({
    where: { id: params.id },
    data: { status: "declined", declinedAt: new Date() },
  });

  return success(null);
}

import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const ticket = await prisma.userInventory.findFirst({
    where: { userId: user.userId, item: { name: "Alchemy Ticket" } },
    select: { quantity: true },
  });

  return success({ count: ticket?.quantity ?? 0 });
}

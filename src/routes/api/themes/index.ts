import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET() {
  const themes = await prisma.theme.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { coinCost: "asc" }],
  });
  return success(themes);
}

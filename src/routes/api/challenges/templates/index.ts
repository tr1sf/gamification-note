import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET() {
  const templates = await prisma.challengeTemplate.findMany({
    where: { isActive: true },
    orderBy: { usageCount: "desc" },
    take: 20,
  });
  return success(templates);
}

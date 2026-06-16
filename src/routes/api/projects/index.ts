import type { Prisma } from "@prisma/client";
import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "active";

  const projects = await prisma.project.findMany({
    where: { userId: user.userId, status },
    include: { milestones: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return success(projects);
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  if (!body.title || typeof body.title !== "string") return error("VALIDATION_ERROR", "Title required", 400);

  const project = await prisma.project.create({
    data: {
      userId: user.userId,
      title: body.title,
      description: body.description || null,
      theme: body.theme || "journey",
    },
    include: { milestones: true },
  });

  return success(project);
}

import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { milestones: { orderBy: { order: "asc" } } },
  });
  if (!project || project.userId !== user.userId) return error("NOT_FOUND", "Project not found", 404);

  return success(project.milestones);
}

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!project || project.userId !== user.userId) return error("NOT_FOUND", "Project not found", 404);

  const body = await request.json();
  if (!body.title || typeof body.title !== "string") return error("VALIDATION_ERROR", "Title required", 400);

  const maxOrder = await prisma.milestone.findFirst({
    where: { projectId: params.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const milestone = await prisma.milestone.create({
    data: {
      projectId: params.id,
      title: body.title,
      description: body.description || null,
      order: (maxOrder?.order ?? -1) + 1,
    },
  });

  return success(milestone);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const milestoneId = url.searchParams.get("milestoneId");
  if (!milestoneId) return error("VALIDATION_ERROR", "milestoneId query param required", 400);

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!project || project.userId !== user.userId) return error("NOT_FOUND", "Project not found", 404);

  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone || milestone.projectId !== params.id) return error("NOT_FOUND", "Milestone not found", 404);

  const body = await request.json();
  const completed = body.completed === true;

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  if (completed) {
    processAction({
      userId: user.userId,
      actionType: "create_note",
      metadata: { milestoneId: updated.id, projectId: params.id, milestoneTitle: updated.title },
    }).catch(() => {});
  }

  return success(updated);
}

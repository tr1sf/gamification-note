import type { Prisma } from "@prisma/client";

interface UserQuestWithQuest {
  id: string;
  questId: string;
  progress: Prisma.JsonValue;
  createdAt: Date;
  quest: {
    id: string;
    mechanic: string;
    mechanicConfig: Prisma.JsonValue;
    criteria: Prisma.JsonValue;
  };
}

interface MechanicResult {
  progress: number;
  completed: boolean;
}

async function checkMechanicProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  uq: UserQuestWithQuest,
  actionType: string,
  metadata?: Record<string, unknown>
): Promise<MechanicResult> {
  const mechanic = uq.quest.mechanic || "counter";
  const config = (uq.quest.mechanicConfig as Record<string, unknown>) || {};
  const criteria = uq.quest.criteria as Record<string, unknown>;
  const target = typeof criteria.count === "number" ? criteria.count : 1;
  const now = new Date();

  switch (mechanic) {
    case "time_limit": {
      const timeWindowMinutes = (config.timeWindowMinutes as number) || 15;
      const questCreatedAt = new Date(uq.createdAt);
      const deadline = new Date(questCreatedAt.getTime() + timeWindowMinutes * 60 * 1000);
      if (now <= deadline) {
        return { progress: 1, completed: true };
      }
      return { progress: 0, completed: false };
    }

    case "streak_guard": {
      const minStreak = (config.minStreak as number) || 1;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { streak: true } });
      const streak = user?.streak ?? 0;
      const completed = streak >= minStreak;
      return { progress: completed ? 1 : 0, completed };
    }

    case "time_window": {
      const startHour = (config.startHour as number) ?? 21;
      const endHour = (config.endHour as number) ?? 24;
      const currentHour = now.getHours();
      if (currentHour >= startHour && currentHour < endHour) {
        return { progress: 1, completed: true };
      }
      return { progress: 0, completed: false };
    }

    case "tag_variety": {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const notes = await tx.note.findMany({
        where: { userId, isDeleted: false, createdAt: { gte: sevenDaysAgo } },
        select: { tags: true },
      });
      const uniqueTags = new Set<string>();
      for (const note of notes) {
        for (const tag of note.tags) {
          uniqueTags.add(tag);
        }
      }
      const progress = Math.min(uniqueTags.size, target);
      return { progress, completed: progress >= target };
    }

    case "structure_score": {
      const minScore = (config.minScore as number) || 7;
      const auditLog = await tx.auditLog.findFirst({
        where: {
          userId,
          actionType: "note_quality_score",
          createdAt: { gte: uq.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { metadata: true },
      });
      let score = 0;
      if (auditLog?.metadata && typeof auditLog.metadata === "object" && !Array.isArray(auditLog.metadata)) {
        score = (auditLog.metadata as Record<string, unknown>).structureScore as number || 0;
      }
      const completed = score >= minScore;
      return { progress: completed ? 1 : 0, completed };
    }

    case "social": {
      const count = await tx.guildMessage.count({
        where: { userId, createdAt: { gte: uq.createdAt } },
      });
      const progress = Math.min(count, target);
      return { progress, completed: progress >= target };
    }

    case "counter":
    default: {
      const increment =
        actionType === "write_words"
          ? (typeof metadata?.wordCount === "number" ? metadata.wordCount : 0)
          : (typeof metadata?.questProgress === "number" ? metadata.questProgress : 1);
      const current =
        typeof (uq.progress as Record<string, unknown>)?.current === "number"
          ? ((uq.progress as Record<string, unknown>).current as number)
          : 0;
      const newProgress = current + increment;
      return { progress: newProgress, completed: newProgress >= target };
    }
  }
}

export async function checkQuestProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  actionType: string,
  metadata?: Record<string, unknown>
): Promise<{ questId: string; progress: number; target: number; completed: boolean }[]> {
  const userQuests = await tx.userQuest.findMany({
    where: { userId, status: "active" },
    include: { quest: true },
  });

  if (userQuests.length === 0) return [];

  const results: { questId: string; progress: number; target: number; completed: boolean }[] = [];

  for (const uq of userQuests) {
    const criteria = uq.quest.criteria as Record<string, unknown>;
    if (criteria.action !== actionType) continue;

    const { progress, completed } = await checkMechanicProgress(
      tx,
      userId,
      uq as unknown as UserQuestWithQuest,
      actionType,
      metadata
    );

    const target = typeof criteria.count === "number" ? criteria.count : 1;

    await tx.userQuest.update({
      where: { id: uq.id },
      data: {
        progress: { current: progress },
        ...(completed
          ? { status: "completed", completedAt: new Date() }
          : {}),
      },
    });

    results.push({
      questId: uq.questId,
      progress,
      target,
      completed,
    });
  }

  return results;
}

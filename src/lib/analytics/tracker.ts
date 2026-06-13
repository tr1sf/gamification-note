import { prisma } from "~/lib/db";
import type { Prisma } from "@prisma/client";
import type { AuditMetadata, AnalyticsActionType } from "./types";

export interface TrackOptions {
  userId: string;
  actionType: AnalyticsActionType;
  xpChange?: number;
  coinChange?: number;
  metadata?: AuditMetadata;
}

export async function track(opts: TrackOptions): Promise<void> {
  const { userId, actionType, xpChange = 0, coinChange = 0, metadata = {} } = opts;

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        actionType,
        xpChange,
        coinChange,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Never throw on analytics failure
  }
}

export async function trackInTransaction(
  tx: Prisma.TransactionClient,
  opts: TrackOptions,
): Promise<void> {
  const { userId, actionType, xpChange = 0, coinChange = 0, metadata = {} } = opts;

  try {
    await tx.auditLog.create({
      data: {
        userId,
        actionType,
        xpChange,
        coinChange,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Never throw on analytics failure
  }
}

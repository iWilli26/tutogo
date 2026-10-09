import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { anomalies, type AnomalyType } from "@/db/schema";
import { logAudit, type Executor } from "@/server/audit";

export interface AnomalyInput {
  type: AnomalyType;
  dedupeKey: string;
  details: string;
  sessionId?: string;
  userId?: string;
}

export function raiseAnomaly(x: Executor, input: AnomalyInput, now: Date): boolean {
  const id = randomUUID();
  const inserted = x
    .insert(anomalies)
    .values({
      id,
      type: input.type,
      dedupeKey: input.dedupeKey,
      details: input.details,
      sessionId: input.sessionId ?? null,
      userId: input.userId ?? null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .run();
  if (inserted.changes === 0) return false;
  logAudit(
    x,
    {
      actorId: null,
      action: "ANOMALY_RAISED",
      entityType: "anomaly",
      entityId: id,
      payload: { type: input.type, sessionId: input.sessionId, userId: input.userId },
    },
    now,
  );
  return true;
}

export function openAnomaliesForSession(x: Executor, sessionId: string) {
  return x
    .select()
    .from(anomalies)
    .where(and(eq(anomalies.sessionId, sessionId), eq(anomalies.status, "OPEN")))
    .all();
}

import type { Db, Tx } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type { Tx };
export type Executor = Db | Tx;

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: "session" | "user" | "relationship" | "anomaly" | "subject";
  entityId: string;
  payload?: Record<string, unknown>;
}

export async function logAudit(x: Executor, entry: AuditEntry, now: Date): Promise<void> {
  await x.insert(auditLogs).values({
    at: now,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    payload: JSON.stringify(entry.payload ?? {}),
  });
}

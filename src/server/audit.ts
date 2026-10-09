import type { Db } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: "session" | "user" | "relationship" | "anomaly" | "subject";
  entityId: string;
  payload?: Record<string, unknown>;
}

export function logAudit(x: Executor, entry: AuditEntry, now: Date): void {
  x.insert(auditLogs)
    .values({
      at: now,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: JSON.stringify(entry.payload ?? {}),
    })
    .run();
}

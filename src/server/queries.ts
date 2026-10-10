import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, isNull, lt, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  anomalies,
  auditLogs,
  sessionConfirmations,
  sessions,
  subjects,
  tutorTuteeRelationships,
  users,
  type SessionStatus,
} from "@/db/schema";
import { raiseAnomaly } from "@/server/anomalies";

const tutorUser = alias(users, "tutor_user");
const tuteeUser = alias(users, "tutee_user");

export interface SessionFilter {
  tutorId?: string;
  tuteeId?: string;
  sessionId?: string;
  statuses?: SessionStatus[];
  limit?: number;
}

export async function listSessionViews(db: Db, filter: SessionFilter = {}) {
  const conditions: SQL[] = [];
  if (filter.tutorId) conditions.push(eq(sessions.tutorId, filter.tutorId));
  if (filter.tuteeId) conditions.push(eq(sessions.tuteeId, filter.tuteeId));
  if (filter.sessionId) conditions.push(eq(sessions.id, filter.sessionId));
  if (filter.statuses) conditions.push(inArray(sessions.status, filter.statuses));
  return db
    .select({
      session: sessions,
      tutorName: tutorUser.name,
      tuteeName: tuteeUser.name,
      subjectName: subjects.name,
      tuteeParticipated: sessionConfirmations.participated,
      tuteeBucket: sessionConfirmations.durationBucket,
      tuteeConfirmedAt: sessionConfirmations.confirmedAt,
    })
    .from(sessions)
    .innerJoin(tutorUser, eq(tutorUser.id, sessions.tutorId))
    .innerJoin(tuteeUser, eq(tuteeUser.id, sessions.tuteeId))
    .innerJoin(subjects, eq(subjects.id, sessions.subjectId))
    .leftJoin(sessionConfirmations, eq(sessionConfirmations.sessionId, sessions.id))
    .where(and(...conditions))
    .orderBy(desc(sessions.createdAt))
    .limit(filter.limit ?? 200);
}

export type SessionView = Awaited<ReturnType<typeof listSessionViews>>[number];

export async function listTuteesOf(db: Db, tutorId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(tutorTuteeRelationships)
    .innerJoin(users, eq(users.id, tutorTuteeRelationships.tuteeId))
    .where(
      and(
        eq(tutorTuteeRelationships.tutorId, tutorId),
        eq(tutorTuteeRelationships.active, true),
        eq(users.active, true),
      ),
    )
    .orderBy(users.name);
}

export async function listSubjects(db: Db) {
  return db.select().from(subjects).orderBy(subjects.name);
}

export async function listAnomalyViews(db: Db, status?: "OPEN") {
  return db
    .select({ anomaly: anomalies, userName: users.name })
    .from(anomalies)
    .leftJoin(users, eq(users.id, anomalies.userId))
    .where(status ? eq(anomalies.status, status) : undefined)
    .orderBy(desc(anomalies.createdAt))
    .limit(300);
}

export async function listUsers(db: Db) {
  return db.select().from(users).orderBy(users.role, users.name);
}

export async function listRelationships(db: Db) {
  const tutor = alias(users, "rel_tutor");
  const tutee = alias(users, "rel_tutee");
  return db
    .select({
      id: tutorTuteeRelationships.id,
      active: tutorTuteeRelationships.active,
      tutorName: tutor.name,
      tuteeName: tutee.name,
    })
    .from(tutorTuteeRelationships)
    .innerJoin(tutor, eq(tutor.id, tutorTuteeRelationships.tutorId))
    .innerJoin(tutee, eq(tutee.id, tutorTuteeRelationships.tuteeId))
    .orderBy(tutor.name, tutee.name);
}

export async function listAuditLogs(db: Db, limit = 200) {
  return db
    .select({ log: auditLogs, actorName: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .orderBy(desc(auditLogs.id))
    .limit(limit);
}

const HOUR_MS = 3_600_000;
const NEVER_DECLARED_AFTER_MS = 24 * HOUR_MS;
const NEVER_CONFIRMED_AFTER_MS = 72 * HOUR_MS;

export async function scanStaleSessions(db: Db, now = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const undeclared = await tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.status, "PENDING"),
          isNull(sessions.tutorDeclaredAt),
          lt(sessions.createdAt, new Date(now.getTime() - NEVER_DECLARED_AFTER_MS)),
        ),
      );
    for (const s of undeclared) {
      await raiseAnomaly(
        tx,
        {
          type: "SESSION_NEVER_COMPLETED",
          dedupeKey: `SESSION_NEVER_COMPLETED:declare:${s.id}`,
          sessionId: s.id,
          userId: s.tutorId,
          details: "Séance préparée il y a plus de 24 h et jamais déclarée terminée par le tuteur.",
        },
        now,
      );
    }
    const unconfirmed = await tx
      .select()
      .from(sessions)
      .leftJoin(sessionConfirmations, eq(sessionConfirmations.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.status, "PENDING"),
          isNull(sessionConfirmations.id),
          lt(sessions.tutorDeclaredAt, new Date(now.getTime() - NEVER_CONFIRMED_AFTER_MS)),
        ),
      );
    for (const { sessions: s } of unconfirmed) {
      await raiseAnomaly(
        tx,
        {
          type: "SESSION_NEVER_COMPLETED",
          dedupeKey: `SESSION_NEVER_COMPLETED:confirm:${s.id}`,
          sessionId: s.id,
          userId: s.tuteeId,
          details:
            "Séance déclarée par le tuteur il y a plus de 72 h et jamais confirmée par le tutoré.",
        },
        now,
      );
    }
  });
}

import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { anomalies, sessions, users } from "@/db/schema";

export function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

export function getTutorTotals(db: Db, tutorId: string, now = new Date()) {
  const validated = and(eq(sessions.tutorId, tutorId), eq(sessions.status, "VALIDATED"));
  const total = db
    .select({
      minutes: sql<number>`coalesce(sum(${sessions.validatedMinutes}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(sessions)
    .where(validated)
    .get();
  const week = db
    .select({ minutes: sql<number>`coalesce(sum(${sessions.validatedMinutes}), 0)` })
    .from(sessions)
    .where(and(validated, gte(sessions.createdAt, startOfWeek(now))))
    .get();
  return {
    validatedMinutes: total?.minutes ?? 0,
    validatedCount: total?.count ?? 0,
    weekMinutes: week?.minutes ?? 0,
  };
}

export function getLeaderboard(db: Db) {
  return db
    .select({
      tutorId: users.id,
      name: users.name,
      minutes: sql<number>`coalesce(sum(case when ${sessions.status} = 'VALIDATED' then ${sessions.validatedMinutes} else 0 end), 0)`,
    })
    .from(users)
    .leftJoin(sessions, eq(sessions.tutorId, users.id))
    .where(and(eq(users.role, "TUTOR"), eq(users.active, true)))
    .groupBy(users.id)
    .orderBy(desc(sql`2 + 0`), users.name)
    .all();
}

export function getAdminStats(db: Db) {
  const countRole = (role: "TUTOR" | "TUTEE") =>
    db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, role), eq(users.active, true)))
      .get()?.n ?? 0;
  const declaredMinutes = (statuses: ("PENDING" | "TO_REVIEW" | "VALIDATED" | "REFUSED")[]) =>
    db
      .select({ m: sql<number>`coalesce(sum(${sessions.tutorDurationMin}), 0)` })
      .from(sessions)
      .where(and(isNotNull(sessions.tutorDeclaredAt), inArray(sessions.status, statuses)))
      .get()?.m ?? 0;
  const sessionCount = (where?: ReturnType<typeof eq>) =>
    db
      .select({ n: sql<number>`count(*)` })
      .from(sessions)
      .where(where)
      .get()?.n ?? 0;
  const validatedMinutes =
    db
      .select({ m: sql<number>`coalesce(sum(${sessions.validatedMinutes}), 0)` })
      .from(sessions)
      .where(eq(sessions.status, "VALIDATED"))
      .get()?.m ?? 0;
  return {
    tutors: countRole("TUTOR"),
    tutees: countRole("TUTEE"),
    sessions: sessionCount(),
    totalMinutes: declaredMinutes(["PENDING", "TO_REVIEW", "VALIDATED"]),
    validatedMinutes,
    pendingMinutes: declaredMinutes(["PENDING", "TO_REVIEW"]),
    flaggedSessions: sessionCount(eq(sessions.status, "TO_REVIEW")),
    openAnomalies:
      db
        .select({ n: sql<number>`count(*)` })
        .from(anomalies)
        .where(eq(anomalies.status, "OPEN"))
        .get()?.n ?? 0,
  };
}

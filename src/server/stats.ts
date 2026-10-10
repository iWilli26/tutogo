import { and, desc, eq, gte, inArray, isNotNull, sql, type SQLWrapper } from "drizzle-orm";
import type { Db } from "@/db/client";
import { anomalies, sessions, users } from "@/db/schema";

export function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

// Postgres returns sum()/count() as bigint, which the driver hands back as a string.
const rowCount = sql`count(*)`.mapWith(Number);
const minutesSum = (expr: SQLWrapper) => sql`coalesce(sum(${expr}), 0)`.mapWith(Number);

export async function getTutorTotals(db: Db, tutorId: string, now = new Date()) {
  const validated = and(eq(sessions.tutorId, tutorId), eq(sessions.status, "VALIDATED"));
  const [total] = await db
    .select({ minutes: minutesSum(sessions.validatedMinutes), count: rowCount })
    .from(sessions)
    .where(validated);
  const [week] = await db
    .select({ minutes: minutesSum(sessions.validatedMinutes) })
    .from(sessions)
    .where(and(validated, gte(sessions.createdAt, startOfWeek(now))));
  return {
    validatedMinutes: total?.minutes ?? 0,
    validatedCount: total?.count ?? 0,
    weekMinutes: week?.minutes ?? 0,
  };
}

export function getLeaderboard(db: Db) {
  const minutes = minutesSum(
    sql`case when ${sessions.status} = 'VALIDATED' then ${sessions.validatedMinutes} else 0 end`,
  );
  return db
    .select({ tutorId: users.id, name: users.name, minutes })
    .from(users)
    .leftJoin(sessions, eq(sessions.tutorId, users.id))
    .where(and(eq(users.role, "TUTOR"), eq(users.active, true)))
    .groupBy(users.id)
    .orderBy(desc(minutes), users.name);
}

export async function getAdminStats(db: Db) {
  const countRole = async (role: "TUTOR" | "TUTEE") => {
    const [row] = await db
      .select({ n: rowCount })
      .from(users)
      .where(and(eq(users.role, role), eq(users.active, true)));
    return row?.n ?? 0;
  };
  const declaredMinutes = async (
    statuses: ("PENDING" | "TO_REVIEW" | "VALIDATED" | "REFUSED")[],
  ) => {
    const [row] = await db
      .select({ m: minutesSum(sessions.tutorDurationMin) })
      .from(sessions)
      .where(and(isNotNull(sessions.tutorDeclaredAt), inArray(sessions.status, statuses)));
    return row?.m ?? 0;
  };
  const sessionCount = async (where?: ReturnType<typeof eq>) => {
    const [row] = await db.select({ n: rowCount }).from(sessions).where(where);
    return row?.n ?? 0;
  };
  const [validated] = await db
    .select({ m: minutesSum(sessions.validatedMinutes) })
    .from(sessions)
    .where(eq(sessions.status, "VALIDATED"));
  const [open] = await db
    .select({ n: rowCount })
    .from(anomalies)
    .where(eq(anomalies.status, "OPEN"));
  return {
    tutors: await countRole("TUTOR"),
    tutees: await countRole("TUTEE"),
    sessions: await sessionCount(),
    totalMinutes: await declaredMinutes(["PENDING", "TO_REVIEW", "VALIDATED"]),
    validatedMinutes: validated?.m ?? 0,
    pendingMinutes: await declaredMinutes(["PENDING", "TO_REVIEW"]),
    flaggedSessions: await sessionCount(eq(sessions.status, "TO_REVIEW")),
    openAnomalies: open?.n ?? 0,
  };
}

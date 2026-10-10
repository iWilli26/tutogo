import { and, eq, gte, isNotNull, ne, or } from "drizzle-orm";
import { sessions } from "@/db/schema";
import { LONG_SESSION_MIN, formatMinutes } from "@/domain/duration";
import { cannotBothFit, type SessionWindow } from "@/domain/overlap";
import { raiseAnomaly } from "@/server/anomalies";
import type { Executor } from "@/server/audit";

type SessionRow = typeof sessions.$inferSelect;

const DAY_MS = 86_400_000;
const MAX_SESSIONS_PER_DAY = 4;
const MAX_MINUTES_PER_WEEK = 20 * 60;

function windowOf(s: SessionRow): SessionWindow {
  return {
    startMs: s.createdAt.getTime(),
    endMs: (s.tutorDeclaredAt ?? s.createdAt).getTime(),
    durationMin: s.tutorDurationMin ?? 0,
  };
}

async function detectOverlaps(x: Executor, session: SessionRow, now: Date): Promise<void> {
  const others = await x
    .select()
    .from(sessions)
    .where(
      and(
        ne(sessions.id, session.id),
        isNotNull(sessions.tutorDeclaredAt),
        ne(sessions.status, "REFUSED"),
        or(eq(sessions.tutorId, session.tutorId), eq(sessions.tuteeId, session.tuteeId)),
      ),
    );
  const mine = windowOf(session);
  for (const other of others) {
    if (!cannotBothFit(mine, windowOf(other))) continue;
    const sameTutor = other.tutorId === session.tutorId;
    const type =
      sameTutor && other.tuteeId !== session.tuteeId
        ? "TUTOR_MULTIPLE_TUTEES"
        : "OVERLAPPING_SESSIONS";
    await raiseAnomaly(
      x,
      {
        type,
        dedupeKey: `${type}:${[session.id, other.id].sort().join(":")}`,
        sessionId: session.id,
        userId: session.tutorId,
        details: `Cette séance (${formatMinutes(mine.durationMin)}) ne peut pas tenir à côté de la séance ${other.id.slice(0, 8)} (${formatMinutes(other.tutorDurationMin ?? 0)}) dans la même période.`,
      },
      now,
    );
  }
}

async function detectFrequency(x: Executor, session: SessionRow, now: Date): Promise<void> {
  const recent = await x
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tutorId, session.tutorId),
        isNotNull(sessions.tutorDeclaredAt),
        ne(sessions.status, "REFUSED"),
        gte(sessions.tutorDeclaredAt, new Date(now.getTime() - 7 * DAY_MS)),
      ),
    );
  const lastDay = recent.filter(
    (s) => (s.tutorDeclaredAt?.getTime() ?? 0) >= now.getTime() - DAY_MS,
  );
  const weekMinutes = recent.reduce((sum, s) => sum + (s.tutorDurationMin ?? 0), 0);
  if (lastDay.length > MAX_SESSIONS_PER_DAY || weekMinutes > MAX_MINUTES_PER_WEEK) {
    await raiseAnomaly(
      x,
      {
        type: "FREQUENT_SESSIONS",
        dedupeKey: `FREQUENT_SESSIONS:${session.id}`,
        sessionId: session.id,
        userId: session.tutorId,
        details: `${lastDay.length} séances déclarées en 24 h, ${formatMinutes(weekMinutes)} déclarées sur 7 jours.`,
      },
      now,
    );
  }
}

export async function runDeclarationDetectors(
  x: Executor,
  session: SessionRow,
  now: Date,
): Promise<void> {
  if ((session.tutorDurationMin ?? 0) > LONG_SESSION_MIN) {
    await raiseAnomaly(
      x,
      {
        type: "SESSION_TOO_LONG",
        dedupeKey: `SESSION_TOO_LONG:${session.id}`,
        sessionId: session.id,
        userId: session.tutorId,
        details: `Durée déclarée de ${formatMinutes(session.tutorDurationMin ?? 0)}, au-delà de ${formatMinutes(LONG_SESSION_MIN)}.`,
      },
      now,
    );
  }
  await detectOverlaps(x, session, now);
  await detectFrequency(x, session, now);
}

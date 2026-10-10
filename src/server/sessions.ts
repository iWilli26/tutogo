import { randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  sessionConfirmations,
  sessions,
  subjects,
  tutorTuteeRelationships,
  users,
  type DurationBucket,
} from "@/db/schema";
import {
  ELAPSED_TOLERANCE_MIN,
  MAX_DECLARABLE_MIN,
  MIN_DECLARABLE_MIN,
  compareDeclarations,
  formatMinutes,
} from "@/domain/duration";
import { openAnomaliesForSession, raiseAnomaly } from "@/server/anomalies";
import { logAudit, type Executor } from "@/server/audit";
import { runDeclarationDetectors } from "@/server/detectors";
import { DomainError } from "@/server/errors";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const INSTANT_CONFIRMATION_MS = 15_000;
const RECENT_WINDOW = 5;
const FLAGGED_THRESHOLD = 3;

function generateCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join("");
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface PrepareInput {
  tuteeId: string;
  subjectId: string;
}

export async function prepareSession(
  db: Db,
  tutorId: string,
  input: PrepareInput,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [relationship] = await tx
      .select({ id: tutorTuteeRelationships.id })
      .from(tutorTuteeRelationships)
      .innerJoin(users, eq(users.id, tutorTuteeRelationships.tuteeId))
      .where(
        and(
          eq(tutorTuteeRelationships.tutorId, tutorId),
          eq(tutorTuteeRelationships.tuteeId, input.tuteeId),
          eq(tutorTuteeRelationships.active, true),
          eq(users.active, true),
        ),
      )
      .for("update", { of: tutorTuteeRelationships });
    if (!relationship) throw new DomainError("Ce tutoré n'est pas associé à ton compte.");
    const [subject] = await tx.select().from(subjects).where(eq(subjects.id, input.subjectId));
    if (!subject) throw new DomainError("Matière inconnue.");

    const [existing] = await tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tutorId, tutorId),
          eq(sessions.tuteeId, input.tuteeId),
          eq(sessions.subjectId, input.subjectId),
          isNull(sessions.tutorDeclaredAt),
        ),
      );
    if (existing) {
      await raiseAnomaly(
        tx,
        {
          type: "DUPLICATE_ATTEMPT",
          dedupeKey: `DUPLICATE_ATTEMPT:${existing.id}:${now.getTime()}`,
          sessionId: existing.id,
          userId: tutorId,
          details: "Tentative de préparer une séance identique à une séance déjà ouverte.",
        },
        now,
      );
      return { session: existing, reused: true };
    }

    const open = await tx
      .select({ code: sessions.code })
      .from(sessions)
      .where(and(eq(sessions.tutorId, tutorId), isNull(sessions.tutorDeclaredAt)));
    const openCodes = new Set(open.map((r) => r.code));
    let code = generateCode();
    while (openCodes.has(code)) code = generateCode();

    const id = randomUUID();
    await tx.insert(sessions).values({
      id,
      code,
      tutorId,
      tuteeId: input.tuteeId,
      subjectId: input.subjectId,
      createdAt: now,
    });
    await logAudit(
      tx,
      {
        actorId: tutorId,
        action: "SESSION_CREATED",
        entityType: "session",
        entityId: id,
        payload: { tuteeId: input.tuteeId, subjectId: input.subjectId },
      },
      now,
    );
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, id));
    if (!session) throw new Error("Session insert failed");
    return { session, reused: false };
  });
}

export interface DeclareInput {
  code: string;
  durationMin: number;
}

export async function declareSession(
  db: Db,
  tutorId: string,
  input: DeclareInput,
  now = new Date(),
) {
  const outcome = await db.transaction(async (tx) => {
    const code = normalizeCode(input.code);
    const [session] = await tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tutorId, tutorId),
          eq(sessions.code, code),
          isNull(sessions.tutorDeclaredAt),
        ),
      )
      .for("update");
    if (!session) {
      await logAudit(
        tx,
        { actorId: tutorId, action: "DECLARATION_BAD_CODE", entityType: "user", entityId: tutorId },
        now,
      );
      return { error: "Code inconnu ou séance déjà terminée." };
    }
    const duration = input.durationMin;
    if (
      !Number.isInteger(duration) ||
      duration < MIN_DECLARABLE_MIN ||
      duration > MAX_DECLARABLE_MIN
    ) {
      return {
        error: `La durée doit être comprise entre ${MIN_DECLARABLE_MIN} min et ${formatMinutes(MAX_DECLARABLE_MIN)}.`,
      };
    }
    const elapsedMin = (now.getTime() - session.createdAt.getTime()) / 60_000;
    if (duration > elapsedMin + ELAPSED_TOLERANCE_MIN) {
      await raiseAnomaly(
        tx,
        {
          type: "DURATION_EXCEEDS_ELAPSED",
          dedupeKey: `DURATION_EXCEEDS_ELAPSED:${session.id}:${now.getTime()}`,
          sessionId: session.id,
          userId: tutorId,
          details: `Déclaration de ${formatMinutes(duration)} alors que seulement ${formatMinutes(elapsedMin)} se sont écoulées depuis la préparation.`,
        },
        now,
      );
      return {
        error: `Impossible : la séance a été préparée il y a ${formatMinutes(elapsedMin)} seulement.`,
      };
    }

    await tx
      .update(sessions)
      .set({ tutorDurationMin: duration, tutorDeclaredAt: now })
      .where(eq(sessions.id, session.id));
    await logAudit(
      tx,
      {
        actorId: tutorId,
        action: "TUTOR_DECLARED",
        entityType: "session",
        entityId: session.id,
        payload: { durationMin: duration },
      },
      now,
    );
    const [declared] = await tx.select().from(sessions).where(eq(sessions.id, session.id));
    if (!declared) throw new Error("Session vanished");
    await runDeclarationDetectors(tx, declared, now);
    return { session: declared };
  });
  if ("error" in outcome) throw new DomainError(outcome.error);
  return outcome.session;
}

export interface ConfirmInput {
  sessionId: string;
  participated: boolean;
  bucket: DurationBucket | null;
}

export async function confirmSession(
  db: Db,
  tuteeId: string,
  input: ConfirmInput,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, input.sessionId), eq(sessions.tuteeId, tuteeId)))
      .for("update");
    if (!session || session.tutorDeclaredAt === null || session.tutorDurationMin === null) {
      throw new DomainError("Aucune séance à confirmer.");
    }
    const [already] = await tx
      .select({ id: sessionConfirmations.id })
      .from(sessionConfirmations)
      .where(eq(sessionConfirmations.sessionId, session.id));
    if (already) throw new DomainError("Cette séance a déjà été confirmée.");
    if (input.participated && !input.bucket) {
      throw new DomainError("Indique la durée approximative de la séance.");
    }
    const bucket = input.participated ? input.bucket : null;

    await tx.insert(sessionConfirmations).values({
      id: randomUUID(),
      sessionId: session.id,
      tuteeId,
      participated: input.participated,
      durationBucket: bucket,
      confirmedAt: now,
    });
    await logAudit(
      tx,
      {
        actorId: tuteeId,
        action: "TUTEE_CONFIRMED",
        entityType: "session",
        entityId: session.id,
        payload: { participated: input.participated, bucket },
      },
      now,
    );

    const comparison = compareDeclarations(session.tutorDurationMin, {
      participated: input.participated,
      bucket,
    });
    await raiseComparisonAnomalies(tx, session, comparison.result, comparison.reason, now);
    if (now.getTime() - session.tutorDeclaredAt.getTime() < INSTANT_CONFIRMATION_MS) {
      await raiseAnomaly(
        tx,
        {
          type: "INSTANT_CONFIRMATION",
          dedupeKey: `INSTANT_CONFIRMATION:${session.id}`,
          sessionId: session.id,
          userId: tuteeId,
          details: "Le tutoré a confirmé moins de 15 secondes après la déclaration du tuteur.",
        },
        now,
      );
    }

    const openAnomalies = await openAnomaliesForSession(tx, session.id);
    const validated = comparison.result === "MATCH" && openAnomalies.length === 0;
    const reason = validated
      ? comparison.reason
      : [
          comparison.result === "MATCH" ? null : comparison.reason,
          ...openAnomalies.map((a) => a.details),
        ]
          .filter(Boolean)
          .join(" ");
    await tx
      .update(sessions)
      .set({
        status: validated ? "VALIDATED" : "TO_REVIEW",
        comparison: comparison.result,
        statusReason: reason,
        validatedMinutes: validated ? comparison.creditedMinutes : 0,
      })
      .where(eq(sessions.id, session.id));
    await logAudit(
      tx,
      {
        actorId: null,
        action: validated ? "SESSION_AUTO_VALIDATED" : "SESSION_FLAGGED",
        entityType: "session",
        entityId: session.id,
        payload: { comparison: comparison.result, creditedMinutes: comparison.creditedMinutes },
      },
      now,
    );
    await flagUnusualTutor(tx, session.tutorId, session.id, now);
    const [updated] = await tx.select().from(sessions).where(eq(sessions.id, session.id));
    if (!updated) throw new Error("Session vanished");
    return updated;
  });
}

async function raiseComparisonAnomalies(
  x: Executor,
  session: typeof sessions.$inferSelect,
  result: "MATCH" | "MISMATCH" | "TUTEE_DENIED",
  reason: string,
  now: Date,
): Promise<void> {
  if (result === "MATCH") return;
  const type = result === "TUTEE_DENIED" ? "TUTEE_DENIED" : "DECLARATION_MISMATCH";
  await raiseAnomaly(
    x,
    {
      type,
      dedupeKey: `${type}:${session.id}`,
      sessionId: session.id,
      userId: result === "TUTEE_DENIED" ? session.tuteeId : session.tutorId,
      details: reason,
    },
    now,
  );
}

async function flagUnusualTutor(
  x: Executor,
  tutorId: string,
  sessionId: string,
  now: Date,
): Promise<void> {
  const recent = await x
    .select({ status: sessions.status })
    .from(sessions)
    .where(
      and(
        eq(sessions.tutorId, tutorId),
        inArray(sessions.status, ["VALIDATED", "TO_REVIEW", "REFUSED"]),
      ),
    )
    .orderBy(desc(sessions.tutorDeclaredAt))
    .limit(RECENT_WINDOW);
  const flagged = recent.filter((s) => s.status !== "VALIDATED").length;
  if (flagged >= FLAGGED_THRESHOLD) {
    await raiseAnomaly(
      x,
      {
        type: "UNUSUAL_ACCOUNT",
        dedupeKey: `UNUSUAL_ACCOUNT:${tutorId}:${sessionId}`,
        userId: tutorId,
        sessionId,
        details: `${flagged} des ${recent.length} dernières séances de ce tuteur sont signalées ou refusées.`,
      },
      now,
    );
  }
}

export interface AdminDecision {
  sessionId: string;
  decision: "VALIDATE" | "REFUSE";
  minutes?: number;
  note: string;
}

export async function decideSession(
  db: Db,
  adminId: string,
  input: AdminDecision,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [admin] = await tx.select().from(users).where(eq(users.id, adminId));
    if (admin?.role !== "ADMIN" || !admin.active)
      throw new DomainError("Action réservée aux administrateurs.");
    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .for("update");
    if (!session) throw new DomainError("Séance introuvable.");
    if (!input.note.trim()) throw new DomainError("Une justification est obligatoire.");

    let minutes = 0;
    if (input.decision === "VALIDATE") {
      if (session.tutorDurationMin === null) {
        throw new DomainError("Impossible de valider une séance que le tuteur n'a pas déclarée.");
      }
      minutes = input.minutes ?? session.tutorDurationMin;
      if (!Number.isInteger(minutes) || minutes <= 0 || minutes > session.tutorDurationMin) {
        throw new DomainError(
          `Les minutes créditées doivent être comprises entre 1 et ${session.tutorDurationMin}.`,
        );
      }
    }
    const status = input.decision === "VALIDATE" ? "VALIDATED" : "REFUSED";
    await tx
      .update(sessions)
      .set({
        status,
        validatedMinutes: minutes,
        statusReason: input.note.trim(),
        decidedBy: adminId,
        decidedAt: now,
      })
      .where(eq(sessions.id, session.id));
    await logAudit(
      tx,
      {
        actorId: adminId,
        action: input.decision === "VALIDATE" ? "ADMIN_VALIDATED" : "ADMIN_REFUSED",
        entityType: "session",
        entityId: session.id,
        payload: { previousStatus: session.status, minutes, note: input.note.trim() },
      },
      now,
    );
    const [updated] = await tx.select().from(sessions).where(eq(sessions.id, session.id));
    if (!updated) throw new Error("Session vanished");
    return updated;
  });
}

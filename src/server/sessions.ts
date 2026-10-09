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

export function prepareSession(db: Db, tutorId: string, input: PrepareInput, now = new Date()) {
  return db.transaction((tx) => {
    const relationship = tx
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
      .get();
    if (!relationship) throw new DomainError("Ce tutoré n'est pas associé à ton compte.");
    const subject = tx.select().from(subjects).where(eq(subjects.id, input.subjectId)).get();
    if (!subject) throw new DomainError("Matière inconnue.");

    const existing = tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tutorId, tutorId),
          eq(sessions.tuteeId, input.tuteeId),
          eq(sessions.subjectId, input.subjectId),
          isNull(sessions.tutorDeclaredAt),
        ),
      )
      .get();
    if (existing) {
      raiseAnomaly(
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

    const openCodes = new Set(
      tx
        .select({ code: sessions.code })
        .from(sessions)
        .where(and(eq(sessions.tutorId, tutorId), isNull(sessions.tutorDeclaredAt)))
        .all()
        .map((r) => r.code),
    );
    let code = generateCode();
    while (openCodes.has(code)) code = generateCode();

    const id = randomUUID();
    tx.insert(sessions)
      .values({
        id,
        code,
        tutorId,
        tuteeId: input.tuteeId,
        subjectId: input.subjectId,
        createdAt: now,
      })
      .run();
    logAudit(
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
    const session = tx.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!session) throw new Error("Session insert failed");
    return { session, reused: false };
  });
}

export interface DeclareInput {
  code: string;
  durationMin: number;
}

export function declareSession(db: Db, tutorId: string, input: DeclareInput, now = new Date()) {
  const outcome = db.transaction((tx) => {
    const code = normalizeCode(input.code);
    const session = tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tutorId, tutorId),
          eq(sessions.code, code),
          isNull(sessions.tutorDeclaredAt),
        ),
      )
      .get();
    if (!session) {
      logAudit(
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
      raiseAnomaly(
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

    tx.update(sessions)
      .set({ tutorDurationMin: duration, tutorDeclaredAt: now })
      .where(eq(sessions.id, session.id))
      .run();
    logAudit(
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
    const declared = tx.select().from(sessions).where(eq(sessions.id, session.id)).get();
    if (!declared) throw new Error("Session vanished");
    runDeclarationDetectors(tx, declared, now);
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

export function confirmSession(db: Db, tuteeId: string, input: ConfirmInput, now = new Date()) {
  return db.transaction((tx) => {
    const session = tx
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, input.sessionId), eq(sessions.tuteeId, tuteeId)))
      .get();
    if (!session || session.tutorDeclaredAt === null || session.tutorDurationMin === null) {
      throw new DomainError("Aucune séance à confirmer.");
    }
    const already = tx
      .select({ id: sessionConfirmations.id })
      .from(sessionConfirmations)
      .where(eq(sessionConfirmations.sessionId, session.id))
      .get();
    if (already) throw new DomainError("Cette séance a déjà été confirmée.");
    if (input.participated && !input.bucket) {
      throw new DomainError("Indique la durée approximative de la séance.");
    }
    const bucket = input.participated ? input.bucket : null;

    tx.insert(sessionConfirmations)
      .values({
        id: randomUUID(),
        sessionId: session.id,
        tuteeId,
        participated: input.participated,
        durationBucket: bucket,
        confirmedAt: now,
      })
      .run();
    logAudit(
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
    raiseComparisonAnomalies(tx, session, comparison.result, comparison.reason, now);
    if (now.getTime() - session.tutorDeclaredAt.getTime() < INSTANT_CONFIRMATION_MS) {
      raiseAnomaly(
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

    const openAnomalies = openAnomaliesForSession(tx, session.id);
    const validated = comparison.result === "MATCH" && openAnomalies.length === 0;
    const reason = validated
      ? comparison.reason
      : [
          comparison.result === "MATCH" ? null : comparison.reason,
          ...openAnomalies.map((a) => a.details),
        ]
          .filter(Boolean)
          .join(" ");
    tx.update(sessions)
      .set({
        status: validated ? "VALIDATED" : "TO_REVIEW",
        comparison: comparison.result,
        statusReason: reason,
        validatedMinutes: validated ? comparison.creditedMinutes : 0,
      })
      .where(eq(sessions.id, session.id))
      .run();
    logAudit(
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
    flagUnusualTutor(tx, session.tutorId, session.id, now);
    const updated = tx.select().from(sessions).where(eq(sessions.id, session.id)).get();
    if (!updated) throw new Error("Session vanished");
    return updated;
  });
}

function raiseComparisonAnomalies(
  x: Executor,
  session: typeof sessions.$inferSelect,
  result: "MATCH" | "MISMATCH" | "TUTEE_DENIED",
  reason: string,
  now: Date,
): void {
  if (result === "MATCH") return;
  const type = result === "TUTEE_DENIED" ? "TUTEE_DENIED" : "DECLARATION_MISMATCH";
  raiseAnomaly(
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

function flagUnusualTutor(x: Executor, tutorId: string, sessionId: string, now: Date): void {
  const recent = x
    .select({ status: sessions.status })
    .from(sessions)
    .where(
      and(
        eq(sessions.tutorId, tutorId),
        inArray(sessions.status, ["VALIDATED", "TO_REVIEW", "REFUSED"]),
      ),
    )
    .orderBy(desc(sessions.tutorDeclaredAt))
    .limit(RECENT_WINDOW)
    .all();
  const flagged = recent.filter((s) => s.status !== "VALIDATED").length;
  if (flagged >= FLAGGED_THRESHOLD) {
    raiseAnomaly(
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

export function decideSession(db: Db, adminId: string, input: AdminDecision, now = new Date()) {
  return db.transaction((tx) => {
    const admin = tx.select().from(users).where(eq(users.id, adminId)).get();
    if (admin?.role !== "ADMIN" || !admin.active)
      throw new DomainError("Action réservée aux administrateurs.");
    const session = tx.select().from(sessions).where(eq(sessions.id, input.sessionId)).get();
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
    tx.update(sessions)
      .set({
        status,
        validatedMinutes: minutes,
        statusReason: input.note.trim(),
        decidedBy: adminId,
        decidedAt: now,
      })
      .where(eq(sessions.id, session.id))
      .run();
    logAudit(
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
    const updated = tx.select().from(sessions).where(eq(sessions.id, session.id)).get();
    if (!updated) throw new Error("Session vanished");
    return updated;
  });
}

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  anomalies,
  subjects,
  tuteeProfiles,
  tutorProfiles,
  tutorTuteeRelationships,
  users,
  type Role,
} from "@/db/schema";
import { DomainError } from "@/server/errors";
import { logAudit, type Executor } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { listSessionViews } from "@/server/queries";
import { BUCKET_RANGES } from "@/domain/duration";

function assertAdmin(db: Executor, adminId: string): void {
  const admin = db.select().from(users).where(eq(users.id, adminId)).get();
  if (admin?.role !== "ADMIN" || !admin.active)
    throw new DomainError("Action réservée aux administrateurs.");
}

export interface NewUser {
  email: string;
  name: string;
  role: Role;
  password: string;
}

export function createUser(db: Db, adminId: string, input: NewUser, now = new Date()) {
  return db.transaction((tx) => {
    assertAdmin(tx, adminId);
    const email = input.email.trim().toLowerCase();
    if (tx.select().from(users).where(eq(users.email, email)).get()) {
      throw new DomainError("Un compte existe déjà avec cet e-mail.");
    }
    const id = randomUUID();
    tx.insert(users)
      .values({
        id,
        email,
        name: input.name.trim(),
        role: input.role,
        passwordHash: hashPassword(input.password),
      })
      .run();
    if (input.role === "TUTOR") tx.insert(tutorProfiles).values({ userId: id }).run();
    if (input.role === "TUTEE") tx.insert(tuteeProfiles).values({ userId: id }).run();
    logAudit(
      tx,
      {
        actorId: adminId,
        action: "USER_CREATED",
        entityType: "user",
        entityId: id,
        payload: { role: input.role },
      },
      now,
    );
    return id;
  });
}

export function setUserActive(
  db: Db,
  adminId: string,
  userId: string,
  active: boolean,
  now = new Date(),
) {
  if (adminId === userId && !active)
    throw new DomainError("Tu ne peux pas désactiver ton propre compte.");
  db.transaction((tx) => {
    assertAdmin(tx, adminId);
    tx.update(users).set({ active }).where(eq(users.id, userId)).run();
    logAudit(
      tx,
      {
        actorId: adminId,
        action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        entityType: "user",
        entityId: userId,
      },
      now,
    );
  });
}

export function linkTutorTutee(
  db: Db,
  adminId: string,
  tutorId: string,
  tuteeId: string,
  now = new Date(),
) {
  db.transaction((tx) => {
    assertAdmin(tx, adminId);
    const tutor = tx
      .select()
      .from(users)
      .where(and(eq(users.id, tutorId), eq(users.role, "TUTOR")))
      .get();
    const tutee = tx
      .select()
      .from(users)
      .where(and(eq(users.id, tuteeId), eq(users.role, "TUTEE")))
      .get();
    if (!tutor || !tutee) throw new DomainError("Il faut un tuteur et un tutoré valides.");
    const existing = tx
      .select()
      .from(tutorTuteeRelationships)
      .where(
        and(
          eq(tutorTuteeRelationships.tutorId, tutorId),
          eq(tutorTuteeRelationships.tuteeId, tuteeId),
        ),
      )
      .get();
    const id = existing?.id ?? randomUUID();
    if (existing) {
      tx.update(tutorTuteeRelationships)
        .set({ active: true })
        .where(eq(tutorTuteeRelationships.id, id))
        .run();
    } else {
      tx.insert(tutorTuteeRelationships).values({ id, tutorId, tuteeId }).run();
    }
    logAudit(
      tx,
      {
        actorId: adminId,
        action: "RELATIONSHIP_ACTIVATED",
        entityType: "relationship",
        entityId: id,
        payload: { tutorId, tuteeId },
      },
      now,
    );
  });
}

export function unlinkTutorTutee(
  db: Db,
  adminId: string,
  relationshipId: string,
  now = new Date(),
) {
  db.transaction((tx) => {
    assertAdmin(tx, adminId);
    tx.update(tutorTuteeRelationships)
      .set({ active: false })
      .where(eq(tutorTuteeRelationships.id, relationshipId))
      .run();
    logAudit(
      tx,
      {
        actorId: adminId,
        action: "RELATIONSHIP_DEACTIVATED",
        entityType: "relationship",
        entityId: relationshipId,
      },
      now,
    );
  });
}

export function addSubject(db: Db, adminId: string, name: string, now = new Date()) {
  db.transaction((tx) => {
    assertAdmin(tx, adminId);
    const trimmed = name.trim();
    if (tx.select().from(subjects).where(eq(subjects.name, trimmed)).get()) {
      throw new DomainError("Cette matière existe déjà.");
    }
    const id = randomUUID();
    tx.insert(subjects).values({ id, name: trimmed }).run();
    logAudit(
      tx,
      {
        actorId: adminId,
        action: "SUBJECT_CREATED",
        entityType: "subject",
        entityId: id,
        payload: { name: trimmed },
      },
      now,
    );
  });
}

export function closeAnomaly(
  db: Db,
  adminId: string,
  anomalyId: string,
  status: "RESOLVED" | "DISMISSED",
  now = new Date(),
) {
  db.transaction((tx) => {
    assertAdmin(tx, adminId);
    tx.update(anomalies)
      .set({ status, resolvedBy: adminId, resolvedAt: now })
      .where(eq(anomalies.id, anomalyId))
      .run();
    logAudit(
      tx,
      { actorId: adminId, action: `ANOMALY_${status}`, entityType: "anomaly", entityId: anomalyId },
      now,
    );
  });
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportSessionsCsv(db: Db, adminId: string): string {
  assertAdmin(db, adminId);
  const header = [
    "id",
    "code",
    "tuteur",
    "tutore",
    "matiere",
    "cree_le",
    "statut",
    "declare_tuteur_min",
    "declare_tutore",
    "minutes_validees",
    "comparaison",
    "motif",
  ];
  const rows = listSessionViews(db, { limit: 100_000 }).map((v) => [
    v.session.id,
    v.session.code,
    v.tutorName,
    v.tuteeName,
    v.subjectName,
    v.session.createdAt.toISOString(),
    v.session.status,
    v.session.tutorDurationMin,
    v.tuteeParticipated === null
      ? ""
      : v.tuteeParticipated
        ? v.tuteeBucket
          ? BUCKET_RANGES[v.tuteeBucket].label
          : ""
        : "N'a pas participé",
    v.session.validatedMinutes,
    v.session.comparison,
    v.session.statusReason,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

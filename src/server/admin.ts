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

async function assertAdmin(db: Executor, adminId: string): Promise<void> {
  const [admin] = await db.select().from(users).where(eq(users.id, adminId));
  if (admin?.role !== "ADMIN" || !admin.active)
    throw new DomainError("Action réservée aux administrateurs.");
}

export interface NewUser {
  email: string;
  name: string;
  role: Role;
  password: string;
}

export async function createUser(db: Db, adminId: string, input: NewUser, now = new Date()) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    const email = input.email.trim().toLowerCase();
    const [taken] = await tx.select().from(users).where(eq(users.email, email));
    if (taken) {
      throw new DomainError("Un compte existe déjà avec cet e-mail.");
    }
    const id = randomUUID();
    await tx.insert(users).values({
      id,
      email,
      name: input.name.trim(),
      role: input.role,
      passwordHash: hashPassword(input.password),
    });
    if (input.role === "TUTOR") await tx.insert(tutorProfiles).values({ userId: id });
    if (input.role === "TUTEE") await tx.insert(tuteeProfiles).values({ userId: id });
    await logAudit(
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

export async function setUserActive(
  db: Db,
  adminId: string,
  userId: string,
  active: boolean,
  now = new Date(),
) {
  if (adminId === userId && !active)
    throw new DomainError("Tu ne peux pas désactiver ton propre compte.");
  await db.transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    await tx.update(users).set({ active }).where(eq(users.id, userId));
    await logAudit(
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

export async function linkTutorTutee(
  db: Db,
  adminId: string,
  tutorId: string,
  tuteeId: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    const [tutor] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, tutorId), eq(users.role, "TUTOR")));
    const [tutee] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, tuteeId), eq(users.role, "TUTEE")));
    if (!tutor || !tutee) throw new DomainError("Il faut un tuteur et un tutoré valides.");
    const [existing] = await tx
      .select()
      .from(tutorTuteeRelationships)
      .where(
        and(
          eq(tutorTuteeRelationships.tutorId, tutorId),
          eq(tutorTuteeRelationships.tuteeId, tuteeId),
        ),
      );
    const id = existing?.id ?? randomUUID();
    if (existing) {
      await tx
        .update(tutorTuteeRelationships)
        .set({ active: true })
        .where(eq(tutorTuteeRelationships.id, id));
    } else {
      await tx.insert(tutorTuteeRelationships).values({ id, tutorId, tuteeId });
    }
    await logAudit(
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

export async function unlinkTutorTutee(
  db: Db,
  adminId: string,
  relationshipId: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    await tx
      .update(tutorTuteeRelationships)
      .set({ active: false })
      .where(eq(tutorTuteeRelationships.id, relationshipId));
    await logAudit(
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

export async function addSubject(db: Db, adminId: string, name: string, now = new Date()) {
  await db.transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    const trimmed = name.trim();
    const [taken] = await tx.select().from(subjects).where(eq(subjects.name, trimmed));
    if (taken) {
      throw new DomainError("Cette matière existe déjà.");
    }
    const id = randomUUID();
    await tx.insert(subjects).values({ id, name: trimmed });
    await logAudit(
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

export async function closeAnomaly(
  db: Db,
  adminId: string,
  anomalyId: string,
  status: "RESOLVED" | "DISMISSED",
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    await tx
      .update(anomalies)
      .set({ status, resolvedBy: adminId, resolvedAt: now })
      .where(eq(anomalies.id, anomalyId));
    await logAudit(
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

export async function exportSessionsCsv(db: Db, adminId: string): Promise<string> {
  await assertAdmin(db, adminId);
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
  const rows = (await listSessionViews(db, { limit: 100_000 })).map((v) => [
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

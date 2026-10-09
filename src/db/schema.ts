import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ROLES = ["TUTOR", "TUTEE", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const SESSION_STATUSES = ["PENDING", "TO_REVIEW", "VALIDATED", "REFUSED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const DURATION_BUCKETS = ["LT30", "30_45", "45_60", "60_90", "90_120", "GT120"] as const;
export type DurationBucket = (typeof DURATION_BUCKETS)[number];

export const COMPARISON_RESULTS = ["MATCH", "MISMATCH", "TUTEE_DENIED"] as const;
export type ComparisonResult = (typeof COMPARISON_RESULTS)[number];

export const ANOMALY_TYPES = [
  "SESSION_TOO_LONG",
  "FREQUENT_SESSIONS",
  "OVERLAPPING_SESSIONS",
  "TUTOR_MULTIPLE_TUTEES",
  "TUTEE_DENIED",
  "DECLARATION_MISMATCH",
  "SESSION_NEVER_COMPLETED",
  "DUPLICATE_ATTEMPT",
  "DURATION_EXCEEDS_ELAPSED",
  "INSTANT_CONFIRMATION",
  "UNUSUAL_ACCOUNT",
] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const ANOMALY_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamp("created_at"),
});

export const tutorProfiles = sqliteTable("tutor_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  promo: text("promo"),
});

export const tuteeProfiles = sqliteTable("tutee_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  promo: text("promo"),
});

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const tutorTuteeRelationships = sqliteTable(
  "tutor_tutee_relationships",
  {
    id: text("id").primaryKey(),
    tutorId: text("tutor_id")
      .notNull()
      .references(() => users.id),
    tuteeId: text("tutee_id")
      .notNull()
      .references(() => users.id),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: timestamp("created_at"),
  },
  (t) => [uniqueIndex("relationship_pair_idx").on(t.tutorId, t.tuteeId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    tutorId: text("tutor_id")
      .notNull()
      .references(() => users.id),
    tuteeId: text("tutee_id")
      .notNull()
      .references(() => users.id),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id),
    status: text("status", { enum: SESSION_STATUSES }).notNull().default("PENDING"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    tutorDurationMin: integer("tutor_duration_min"),
    tutorDeclaredAt: integer("tutor_declared_at", { mode: "timestamp_ms" }),
    comparison: text("comparison", { enum: COMPARISON_RESULTS }),
    statusReason: text("status_reason"),
    validatedMinutes: integer("validated_minutes").notNull().default(0),
    decidedBy: text("decided_by").references(() => users.id),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("sessions_tutor_idx").on(t.tutorId, t.status),
    index("sessions_tutee_idx").on(t.tuteeId, t.status),
    uniqueIndex("sessions_open_code_idx")
      .on(t.tutorId, t.code)
      .where(sql`tutor_declared_at IS NULL`),
  ],
);

export const sessionConfirmations = sqliteTable("session_confirmations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id),
  tuteeId: text("tutee_id")
    .notNull()
    .references(() => users.id),
  participated: integer("participated", { mode: "boolean" }).notNull(),
  durationBucket: text("duration_bucket", { enum: DURATION_BUCKETS }),
  confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }).notNull(),
});

export const anomalies = sqliteTable(
  "anomalies",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ANOMALY_TYPES }).notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    sessionId: text("session_id").references(() => sessions.id),
    userId: text("user_id").references(() => users.id),
    details: text("details").notNull(),
    status: text("status", { enum: ANOMALY_STATUSES }).notNull().default("OPEN"),
    createdAt: timestamp("created_at"),
    resolvedBy: text("resolved_by").references(() => users.id),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("anomalies_status_idx").on(t.status)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: timestamp("at"),
    actorId: text("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: text("payload").notNull().default("{}"),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId)],
);

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { anomalies, auditLogs, sessions, type DurationBucket } from "@/db/schema";
import { confirmSession, declareSession, decideSession, prepareSession } from "@/server/sessions";
import { getTutorTotals } from "@/server/stats";
import { addSubject, addUser, link, makeDb, minutes } from "./helpers";

const T0 = new Date("2026-10-07T15:00:00Z");
const at = (offsetMin: number) => new Date(T0.getTime() + minutes(offsetMin));

describe("session lifecycle", () => {
  let db: Db;
  let tutor: string;
  let tutee: string;
  let admin: string;
  let subject: string;

  beforeEach(() => {
    db = makeDb();
    tutor = addUser(db, "TUTOR", "Amandine");
    tutee = addUser(db, "TUTEE", "Emma");
    admin = addUser(db, "ADMIN", "Resp");
    subject = addSubject(db);
    link(db, tutor, tutee);
  });

  function runSession(tutorMin: number, bucket: DurationBucket | null, offset = 0) {
    const { session } = prepareSession(
      db,
      tutor,
      { tuteeId: tutee, subjectId: subject },
      at(offset),
    );
    declareSession(
      db,
      tutor,
      { code: session.code, durationMin: tutorMin },
      at(offset + tutorMin + 5),
    );
    return confirmSession(
      db,
      tutee,
      { sessionId: session.id, participated: bucket !== null, bucket },
      at(offset + tutorMin + 60),
    );
  }

  it("validates matching declarations and adds hours", () => {
    const s = runSession(55, "45_60");
    expect(s.status).toBe("VALIDATED");
    expect(s.validatedMinutes).toBe(55);
    expect(getTutorTotals(db, tutor, at(2000)).validatedMinutes).toBe(55);
  });

  it("flags a large mismatch and credits nothing", () => {
    const s = runSession(120, "30_45");
    expect(s.status).toBe("TO_REVIEW");
    expect(s.comparison).toBe("MISMATCH");
    expect(getTutorTotals(db, tutor, at(2000)).validatedMinutes).toBe(0);
  });

  it("flags a tutee who denies participation", () => {
    const s = runSession(60, null);
    expect(s.status).toBe("TO_REVIEW");
    expect(s.comparison).toBe("TUTEE_DENIED");
  });

  it("rejects a declaration longer than the time elapsed since preparation", () => {
    const { session } = prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0));
    expect(() =>
      declareSession(db, tutor, { code: session.code, durationMin: 120 }, at(10)),
    ).toThrow();
    const rows = db
      .select()
      .from(anomalies)
      .where(eq(anomalies.type, "DURATION_EXCEEDS_ELAPSED"))
      .all();
    expect(rows).toHaveLength(1);
  });

  it("reuses the open session and logs an anomaly on duplicate preparation", () => {
    const first = prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0));
    const second = prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(1));
    expect(second.reused).toBe(true);
    expect(second.session.id).toBe(first.session.id);
    expect(
      db.select().from(anomalies).where(eq(anomalies.type, "DUPLICATE_ATTEMPT")).all(),
    ).toHaveLength(1);
  });

  it("refuses preparation for an unrelated tutee", () => {
    const stranger = addUser(db, "TUTEE", "Lucas");
    expect(() => prepareSession(db, tutor, { tuteeId: stranger, subjectId: subject })).toThrow();
  });

  it("does not let another tutee confirm a session", () => {
    const other = addUser(db, "TUTEE", "Lucas");
    const { session } = prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0));
    declareSession(db, tutor, { code: session.code, durationMin: 50 }, at(60));
    expect(() =>
      confirmSession(
        db,
        other,
        { sessionId: session.id, participated: true, bucket: "45_60" },
        at(120),
      ),
    ).toThrow();
  });

  it("does not allow a second confirmation", () => {
    const s = runSession(55, "45_60");
    expect(() =>
      confirmSession(db, tutee, { sessionId: s.id, participated: true, bucket: "45_60" }, at(500)),
    ).toThrow();
  });

  it("flags overlapping sessions with two tutees at once", () => {
    const tutee2 = addUser(db, "TUTEE", "Lucas");
    link(db, tutor, tutee2);
    const a = prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0)).session;
    const b = prepareSession(db, tutor, { tuteeId: tutee2, subjectId: subject }, at(0)).session;
    declareSession(db, tutor, { code: a.code, durationMin: 60 }, at(65));
    declareSession(db, tutor, { code: b.code, durationMin: 60 }, at(66));
    const rows = db
      .select()
      .from(anomalies)
      .where(eq(anomalies.type, "TUTOR_MULTIPLE_TUTEES"))
      .all();
    expect(rows).toHaveLength(1);
  });

  it("does not flag two back-to-back sessions declared together", () => {
    const a = prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0)).session;
    const subject2 = addSubject(db, "Physique");
    const b = prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject2 }, at(0)).session;
    declareSession(db, tutor, { code: a.code, durationMin: 55 }, at(120));
    declareSession(db, tutor, { code: b.code, durationMin: 55 }, at(121));
    expect(db.select().from(anomalies).all()).toHaveLength(0);
  });

  it("lets an admin validate a flagged session with a cap and logs it", () => {
    const s = runSession(120, "30_45");
    const decided = decideSession(
      db,
      admin,
      { sessionId: s.id, decision: "VALIDATE", minutes: 40, note: "Vérifié" },
      at(900),
    );
    expect(decided.status).toBe("VALIDATED");
    expect(getTutorTotals(db, tutor, at(2000)).validatedMinutes).toBe(40);
    expect(() =>
      decideSession(db, admin, { sessionId: s.id, decision: "VALIDATE", minutes: 500, note: "x" }),
    ).toThrow();
    const actions = db
      .select()
      .from(auditLogs)
      .all()
      .map((l) => l.action);
    expect(actions).toContain("ADMIN_VALIDATED");
  });

  it("rejects decisions from non-admin users", () => {
    const s = runSession(120, "30_45");
    expect(() =>
      decideSession(db, tutor, { sessionId: s.id, decision: "VALIDATE", note: "x" }),
    ).toThrow();
  });

  it("enforces immutability at the database level", () => {
    const s = runSession(55, "45_60");
    expect(() =>
      db.update(sessions).set({ tutorDurationMin: 500 }).where(eq(sessions.id, s.id)).run(),
    ).toThrow();
    expect(() =>
      db.update(sessions).set({ validatedMinutes: 9999 }).where(eq(sessions.id, s.id)).run(),
    ).toThrow();
    expect(() =>
      db.update(sessions).set({ tutorId: tutee }).where(eq(sessions.id, s.id)).run(),
    ).toThrow();
    expect(() => db.delete(auditLogs).run()).toThrow();
    expect(() => db.delete(sessions).run()).toThrow();
  });

  it("sums validated sessions only: 45 + 65 + 50 = 2 h 40", () => {
    runSession(45, "30_45", 0);
    runSession(65, "60_90", 600);
    runSession(50, "45_60", 1200);
    expect(getTutorTotals(db, tutor, at(5000)).validatedMinutes).toBe(160);
  });
});

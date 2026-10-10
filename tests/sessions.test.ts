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

  beforeEach(async () => {
    db = await makeDb();
    tutor = await addUser(db, "TUTOR", "Amandine");
    tutee = await addUser(db, "TUTEE", "Emma");
    admin = await addUser(db, "ADMIN", "Resp");
    subject = await addSubject(db);
    await link(db, tutor, tutee);
  });

  async function runSession(tutorMin: number, bucket: DurationBucket | null, offset = 0) {
    const { session } = await prepareSession(
      db,
      tutor,
      { tuteeId: tutee, subjectId: subject },
      at(offset),
    );
    await declareSession(
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

  it("validates matching declarations and adds hours", async () => {
    const s = await runSession(55, "45_60");
    expect(s.status).toBe("VALIDATED");
    expect(s.validatedMinutes).toBe(55);
    expect((await getTutorTotals(db, tutor, at(2000))).validatedMinutes).toBe(55);
  });

  it("flags a large mismatch and credits nothing", async () => {
    const s = await runSession(120, "30_45");
    expect(s.status).toBe("TO_REVIEW");
    expect(s.comparison).toBe("MISMATCH");
    expect((await getTutorTotals(db, tutor, at(2000))).validatedMinutes).toBe(0);
  });

  it("flags a tutee who denies participation", async () => {
    const s = await runSession(60, null);
    expect(s.status).toBe("TO_REVIEW");
    expect(s.comparison).toBe("TUTEE_DENIED");
  });

  it("rejects a declaration longer than the time elapsed since preparation", async () => {
    const { session } = await prepareSession(
      db,
      tutor,
      { tuteeId: tutee, subjectId: subject },
      at(0),
    );
    await expect(
      declareSession(db, tutor, { code: session.code, durationMin: 120 }, at(10)),
    ).rejects.toThrow();
    const rows = await db
      .select()
      .from(anomalies)
      .where(eq(anomalies.type, "DURATION_EXCEEDS_ELAPSED"));
    expect(rows).toHaveLength(1);
  });

  it("reuses the open session and logs an anomaly on duplicate preparation", async () => {
    const first = await prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0));
    const second = await prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(1));
    expect(second.reused).toBe(true);
    expect(second.session.id).toBe(first.session.id);
    expect(
      await db.select().from(anomalies).where(eq(anomalies.type, "DUPLICATE_ATTEMPT")),
    ).toHaveLength(1);
  });

  it("refuses preparation for an unrelated tutee", async () => {
    const stranger = await addUser(db, "TUTEE", "Lucas");
    await expect(
      prepareSession(db, tutor, { tuteeId: stranger, subjectId: subject }),
    ).rejects.toThrow();
  });

  it("does not let another tutee confirm a session", async () => {
    const other = await addUser(db, "TUTEE", "Lucas");
    const { session } = await prepareSession(
      db,
      tutor,
      { tuteeId: tutee, subjectId: subject },
      at(0),
    );
    await declareSession(db, tutor, { code: session.code, durationMin: 50 }, at(60));
    await expect(
      confirmSession(
        db,
        other,
        { sessionId: session.id, participated: true, bucket: "45_60" },
        at(120),
      ),
    ).rejects.toThrow();
  });

  it("does not allow a second confirmation", async () => {
    const s = await runSession(55, "45_60");
    await expect(
      confirmSession(db, tutee, { sessionId: s.id, participated: true, bucket: "45_60" }, at(500)),
    ).rejects.toThrow();
  });

  it("flags overlapping sessions with two tutees at once", async () => {
    const tutee2 = await addUser(db, "TUTEE", "Lucas");
    await link(db, tutor, tutee2);
    const a = (await prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0)))
      .session;
    const b = (await prepareSession(db, tutor, { tuteeId: tutee2, subjectId: subject }, at(0)))
      .session;
    await declareSession(db, tutor, { code: a.code, durationMin: 60 }, at(65));
    await declareSession(db, tutor, { code: b.code, durationMin: 60 }, at(66));
    const rows = await db
      .select()
      .from(anomalies)
      .where(eq(anomalies.type, "TUTOR_MULTIPLE_TUTEES"));
    expect(rows).toHaveLength(1);
  });

  it("does not flag two back-to-back sessions declared together", async () => {
    const a = (await prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject }, at(0)))
      .session;
    const subject2 = await addSubject(db, "Physique");
    const b = (await prepareSession(db, tutor, { tuteeId: tutee, subjectId: subject2 }, at(0)))
      .session;
    await declareSession(db, tutor, { code: a.code, durationMin: 55 }, at(120));
    await declareSession(db, tutor, { code: b.code, durationMin: 55 }, at(121));
    expect(await db.select().from(anomalies)).toHaveLength(0);
  });

  it("lets an admin validate a flagged session with a cap and logs it", async () => {
    const s = await runSession(120, "30_45");
    const decided = await decideSession(
      db,
      admin,
      { sessionId: s.id, decision: "VALIDATE", minutes: 40, note: "Vérifié" },
      at(900),
    );
    expect(decided.status).toBe("VALIDATED");
    expect((await getTutorTotals(db, tutor, at(2000))).validatedMinutes).toBe(40);
    await expect(
      decideSession(db, admin, { sessionId: s.id, decision: "VALIDATE", minutes: 500, note: "x" }),
    ).rejects.toThrow();
    const actions = (await db.select().from(auditLogs)).map((l) => l.action);
    expect(actions).toContain("ADMIN_VALIDATED");
  });

  it("rejects decisions from non-admin users", async () => {
    const s = await runSession(120, "30_45");
    await expect(
      decideSession(db, tutor, { sessionId: s.id, decision: "VALIDATE", note: "x" }),
    ).rejects.toThrow();
  });

  it("enforces immutability at the database level", async () => {
    const s = await runSession(55, "45_60");
    const forSession = eq(sessions.id, s.id);
    await expect(
      db.update(sessions).set({ tutorDurationMin: 500 }).where(forSession).execute(),
    ).rejects.toThrow();
    await expect(
      db.update(sessions).set({ validatedMinutes: 9999 }).where(forSession).execute(),
    ).rejects.toThrow();
    await expect(
      db.update(sessions).set({ tutorId: tutee }).where(forSession).execute(),
    ).rejects.toThrow();
    await expect(db.delete(auditLogs).execute()).rejects.toThrow();
    await expect(db.delete(sessions).execute()).rejects.toThrow();
  });

  it("sums validated sessions only: 45 + 65 + 50 = 2 h 40", async () => {
    await runSession(45, "30_45", 0);
    await runSession(65, "60_90", 600);
    await runSession(50, "45_60", 1200);
    expect((await getTutorTotals(db, tutor, at(5000))).validatedMinutes).toBe(160);
  });
});

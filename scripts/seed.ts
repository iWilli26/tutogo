import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import {
  subjects,
  tuteeProfiles,
  tutorProfiles,
  tutorTuteeRelationships,
  users,
} from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/server/demo";
import { confirmSession, declareSession, prepareSession } from "@/server/sessions";

const db = getDb();

const [anyUser] = await db.select().from(users).limit(1);
if (anyUser) {
  console.log("La base contient déjà des données : seed ignoré.");
  process.exit(0);
}

const ids = new Map<string, string>();
const passwordHash = hashPassword(DEMO_PASSWORD);
for (const account of DEMO_ACCOUNTS) {
  const id = randomUUID();
  ids.set(account.name, id);
  await db
    .insert(users)
    .values({ id, email: account.email, name: account.name, role: account.role, passwordHash });
  if (account.role === "TUTOR") await db.insert(tutorProfiles).values({ userId: id });
  if (account.role === "TUTEE") await db.insert(tuteeProfiles).values({ userId: id });
}

const subjectIds = new Map<string, string>();
for (const name of ["Mathématiques", "Physique", "Chimie", "Français", "Anglais", "Informatique"]) {
  const id = randomUUID();
  subjectIds.set(name, id);
  await db.insert(subjects).values({ id, name });
}

const get = (map: Map<string, string>, key: string): string => {
  const value = map.get(key);
  if (!value) throw new Error(`Missing seed entry ${key}`);
  return value;
};

for (const [tutor, tutee] of [
  ["Amandine", "Emma"],
  ["Amandine", "Lucas"],
  ["Sarah", "Lucas"],
  ["Maya", "Chloé"],
] as const) {
  await db
    .insert(tutorTuteeRelationships)
    .values({ id: randomUUID(), tutorId: get(ids, tutor), tuteeId: get(ids, tutee) });
}

const DAY = 86_400_000;
const history = [
  ["Amandine", "Emma", "Mathématiques", 55, "45_60", 6],
  ["Amandine", "Lucas", "Physique", 62, "60_90", 5],
  ["Amandine", "Emma", "Mathématiques", 50, "45_60", 3],
  ["Sarah", "Lucas", "Chimie", 70, "60_90", 4],
  ["Maya", "Chloé", "Anglais", 45, "30_45", 2],
] as const;
const base = Date.now();
for (const [tutor, tutee, subject, minutes, bucket, daysAgo] of history) {
  const start = new Date(base - daysAgo * DAY);
  const { session } = await prepareSession(
    db,
    get(ids, tutor),
    { tuteeId: get(ids, tutee), subjectId: get(subjectIds, subject) },
    start,
  );
  await declareSession(
    db,
    get(ids, tutor),
    { code: session.code, durationMin: minutes },
    new Date(start.getTime() + (minutes + 10) * 60_000),
  );
  await confirmSession(
    db,
    get(ids, tutee),
    { sessionId: session.id, participated: true, bucket },
    new Date(start.getTime() + (minutes + 90) * 60_000),
  );
}

console.log(
  `Base initialisée. Mot de passe de tous les comptes de démonstration : ${DEMO_PASSWORD}`,
);
process.exit(0);

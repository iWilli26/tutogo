import { randomUUID } from "node:crypto";
import { createDb, type Db } from "@/db/client";
import { subjects, tutorTuteeRelationships, users, type Role } from "@/db/schema";

export function makeDb(): Db {
  return createDb(":memory:");
}

export function addUser(db: Db, role: Role, name: string): string {
  const id = randomUUID();
  db.insert(users)
    .values({
      id,
      email: `${name.toLowerCase()}-${id.slice(0, 4)}@cimf.test`,
      name,
      role,
      passwordHash: "x",
    })
    .run();
  return id;
}

export function addSubject(db: Db, name = "Maths"): string {
  const id = randomUUID();
  db.insert(subjects).values({ id, name }).run();
  return id;
}

export function link(db: Db, tutorId: string, tuteeId: string): void {
  db.insert(tutorTuteeRelationships).values({ id: randomUUID(), tutorId, tuteeId }).run();
}

export const minutes = (n: number) => n * 60_000;

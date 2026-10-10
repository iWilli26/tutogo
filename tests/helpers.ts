import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { subjects, tutorTuteeRelationships, users, type Role } from "@/db/schema";

export async function makeDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

export async function addUser(db: Db, role: Role, name: string): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `${name.toLowerCase()}-${id.slice(0, 4)}@cimf.test`,
    name,
    role,
    passwordHash: "x",
  });
  return id;
}

export async function addSubject(db: Db, name = "Maths"): Promise<string> {
  const id = randomUUID();
  await db.insert(subjects).values({ id, name });
  return id;
}

export async function link(db: Db, tutorId: string, tuteeId: string): Promise<void> {
  await db.insert(tutorTuteeRelationships).values({ id: randomUUID(), tutorId, tuteeId });
}

export const minutes = (n: number) => n * 60_000;

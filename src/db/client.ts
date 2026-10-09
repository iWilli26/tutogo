import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  return db;
}

const globalForDb = globalThis as unknown as { tutogoDb?: Db };

export function getDb(): Db {
  globalForDb.tutogoDb ??= createDb(process.env["DATABASE_PATH"] ?? "data/tutogo.db");
  return globalForDb.tutogoDb;
}

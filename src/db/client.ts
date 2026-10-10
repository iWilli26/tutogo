import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type Schema = typeof schema;

export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

export function createPool(): Pool {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set (Neon connection string, see .env.example).");
  }
  return new Pool({ connectionString });
}

const globalForDb = globalThis as unknown as { tutogoDb?: Db };

export function getDb(): Db {
  globalForDb.tutogoDb ??= drizzle(createPool(), { schema });
  return globalForDb.tutogoDb;
}

import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export type AuthUser = typeof users.$inferSelect;

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthProvider {
  authenticate(db: Db, credentials: Credentials): AuthUser | null;
}

const DUMMY_HASH = hashPassword("dummy-password-for-timing");

export const localPasswordProvider: AuthProvider = {
  authenticate(db, { email, password }) {
    const user = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
    if (!user) {
      verifyPassword(password, DUMMY_HASH);
      return null;
    }
    if (!verifyPassword(password, user.passwordHash) || !user.active) return null;
    return user;
  },
};

export const authProvider: AuthProvider = localPasswordProvider;

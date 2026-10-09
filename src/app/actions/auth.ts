"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import type { ActionState } from "@/app/actions/result";
import { authProvider } from "@/server/auth/provider";
import { HOME_BY_ROLE, endSession, startSession } from "@/server/auth/session";

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "E-mail ou mot de passe invalide." };
  const user = authProvider.authenticate(getDb(), parsed.data);
  if (!user) return { error: "E-mail ou mot de passe incorrect." };
  await startSession(user.id);
  redirect(HOME_BY_ROLE[user.role]);
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

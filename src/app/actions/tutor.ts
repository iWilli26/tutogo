"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { INVALID_INPUT, toState, type ActionState } from "@/app/actions/result";
import { requireRole } from "@/server/auth/session";
import { declareSession, prepareSession } from "@/server/sessions";

const prepareSchema = z.object({ tuteeId: z.string().min(1), subjectId: z.string().min(1) });
const declareSchema = z.object({
  code: z.string().trim().min(1).max(8),
  durationMin: z.coerce.number().int(),
});

export async function prepareAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tutor = await requireRole("TUTOR");
  const parsed = prepareSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choisis un tutoré et une matière." };
  let sessionId: string;
  try {
    sessionId = (await prepareSession(getDb(), tutor.id, parsed.data)).session.id;
  } catch (e) {
    return toState(e);
  }
  redirect(`/tutor/sessions/${sessionId}`);
}

export async function declareAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tutor = await requireRole("TUTOR");
  const parsed = declareSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return INVALID_INPUT;
  let sessionId: string;
  try {
    sessionId = (await declareSession(getDb(), tutor.id, parsed.data)).id;
  } catch (e) {
    return toState(e);
  }
  redirect(`/tutor/sessions/${sessionId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { DURATION_BUCKETS } from "@/db/schema";
import { INVALID_INPUT, toState, type ActionState } from "@/app/actions/result";
import { requireRole } from "@/server/auth/session";
import { confirmSession } from "@/server/sessions";

const confirmSchema = z.object({
  sessionId: z.string().min(1),
  participated: z.enum(["yes", "no"]),
  bucket: z.enum(DURATION_BUCKETS).optional(),
});

export async function confirmAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tutee = await requireRole("TUTEE");
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return INVALID_INPUT;
  try {
    await confirmSession(getDb(), tutee.id, {
      sessionId: parsed.data.sessionId,
      participated: parsed.data.participated === "yes",
      bucket: parsed.data.bucket ?? null,
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/tutee");
  return {};
}

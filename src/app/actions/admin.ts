"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { ROLES } from "@/db/schema";
import { INVALID_INPUT, toState, type ActionState } from "@/app/actions/result";
import {
  addSubject,
  closeAnomaly,
  createUser,
  linkTutorTutee,
  setUserActive,
  unlinkTutorTutee,
} from "@/server/admin";
import { requireRole } from "@/server/auth/session";
import { decideSession } from "@/server/sessions";

const decideSchema = z.object({
  sessionId: z.string().min(1),
  decision: z.enum(["VALIDATE", "REFUSE"]),
  minutes: z.coerce.number().int().optional(),
  note: z.string().trim().min(1).max(500),
});

export async function decideAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = decideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Indique une décision et une justification." };
  try {
    const { minutes, ...rest } = parsed.data;
    await decideSession(getDb(), admin.id, minutes === undefined ? rest : { ...rest, minutes });
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/admin", "layout");
  return {};
}

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  role: z.enum(ROLES),
  password: z.string().min(8).max(200),
});

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: "Nom, e-mail valide et mot de passe (8 caractères min.) requis." };
  try {
    await createUser(getDb(), admin.id, parsed.data);
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/admin/users");
  return {};
}

const idSchema = z.object({ id: z.string().min(1) });

export async function toggleUserAction(formData: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const parsed = idSchema
    .extend({ active: z.enum(["true", "false"]) })
    .parse(Object.fromEntries(formData));
  await setUserActive(getDb(), admin.id, parsed.id, parsed.active === "true");
  revalidatePath("/admin/users");
}

export async function linkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = z
    .object({ tutorId: z.string().min(1), tuteeId: z.string().min(1) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return INVALID_INPUT;
  try {
    await linkTutorTutee(getDb(), admin.id, parsed.data.tutorId, parsed.data.tuteeId);
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/admin/relationships");
  return {};
}

export async function unlinkAction(formData: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  await unlinkTutorTutee(getDb(), admin.id, idSchema.parse(Object.fromEntries(formData)).id);
  revalidatePath("/admin/relationships");
}

export async function addSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = z
    .object({ name: z.string().trim().min(1).max(60) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return INVALID_INPUT;
  try {
    await addSubject(getDb(), admin.id, parsed.data.name);
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/admin/relationships");
  return {};
}

export async function closeAnomalyAction(formData: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const parsed = idSchema
    .extend({ status: z.enum(["RESOLVED", "DISMISSED"]) })
    .parse(Object.fromEntries(formData));
  await closeAnomaly(getDb(), admin.id, parsed.id, parsed.status);
  revalidatePath("/admin", "layout");
}

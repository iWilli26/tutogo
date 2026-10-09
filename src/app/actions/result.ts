import { DomainError } from "@/server/errors";

export interface ActionState {
  error?: string;
}

export function toState(error: unknown): ActionState {
  if (error instanceof DomainError) return { error: error.message };
  throw error;
}

export const INVALID_INPUT: ActionState = { error: "Formulaire invalide." };

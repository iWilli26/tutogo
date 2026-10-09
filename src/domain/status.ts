import type { AnomalyType, SessionStatus } from "@/db/schema";

export const STATUS_META: Record<SessionStatus, { label: string; emoji: string; tone: string }> = {
  VALIDATED: {
    label: "Validée",
    emoji: "🟢",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  PENDING: { label: "En attente", emoji: "🟡", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  TO_REVIEW: {
    label: "À vérifier",
    emoji: "🟠",
    tone: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  REFUSED: { label: "Refusée", emoji: "🔴", tone: "bg-red-50 text-red-700 ring-red-200" },
};

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  SESSION_TOO_LONG: "Séance trop longue",
  FREQUENT_SESSIONS: "Séances très fréquentes",
  OVERLAPPING_SESSIONS: "Séances qui se chevauchent",
  TUTOR_MULTIPLE_TUTEES: "Plusieurs tutorés au même moment",
  TUTEE_DENIED: "Tutoré : n'a pas participé",
  DECLARATION_MISMATCH: "Déclarations divergentes",
  SESSION_NEVER_COMPLETED: "Séance jamais terminée",
  DUPLICATE_ATTEMPT: "Tentative de séance en double",
  DURATION_EXCEEDS_ELAPSED: "Durée supérieure au temps écoulé",
  INSTANT_CONFIRMATION: "Confirmation instantanée",
  UNUSUAL_ACCOUNT: "Comportement inhabituel du compte",
};

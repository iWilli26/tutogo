import type { ComparisonResult, DurationBucket } from "@/db/schema";

export const TOLERANCE_MIN = 10;
export const MAX_DECLARABLE_MIN = 240;
export const LONG_SESSION_MIN = 150;
export const ELAPSED_TOLERANCE_MIN = 5;
export const MIN_DECLARABLE_MIN = 10;

export const BUCKET_RANGES: Record<DurationBucket, { min: number; max: number; label: string }> = {
  LT30: { min: 0, max: 30, label: "Moins de 30 min" },
  "30_45": { min: 30, max: 45, label: "30–45 min" },
  "45_60": { min: 45, max: 60, label: "45–60 min" },
  "60_90": { min: 60, max: 90, label: "60–90 min" },
  "90_120": { min: 90, max: 120, label: "90–120 min" },
  GT120: { min: 120, max: MAX_DECLARABLE_MIN, label: "Plus de 120 min" },
};

export interface Comparison {
  result: ComparisonResult;
  creditedMinutes: number;
  reason: string;
}

export function compareDeclarations(
  tutorMinutes: number,
  tutee: { participated: boolean; bucket: DurationBucket | null },
): Comparison {
  if (!tutee.participated || tutee.bucket === null) {
    return {
      result: "TUTEE_DENIED",
      creditedMinutes: 0,
      reason: "Le tutoré indique ne pas avoir participé à cette séance.",
    };
  }
  const range = BUCKET_RANGES[tutee.bucket];
  const consistent =
    tutorMinutes >= range.min - TOLERANCE_MIN && tutorMinutes <= range.max + TOLERANCE_MIN;
  if (!consistent) {
    return {
      result: "MISMATCH",
      creditedMinutes: 0,
      reason: `Le tuteur déclare ${formatMinutes(tutorMinutes)}, le tutoré déclare ${range.label}.`,
    };
  }
  return {
    result: "MATCH",
    creditedMinutes: Math.min(tutorMinutes, range.max),
    reason: "Les déclarations du tuteur et du tutoré sont cohérentes.",
  };
}

export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

export function formatTotalHours(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

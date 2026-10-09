import { ELAPSED_TOLERANCE_MIN } from "@/domain/duration";

export interface SessionWindow {
  startMs: number;
  endMs: number;
  durationMin: number;
}

const MS_PER_MIN = 60_000;

export function cannotBothFit(a: SessionWindow, b: SessionWindow): boolean {
  const overlap = a.startMs < b.endMs && b.startMs < a.endMs;
  if (!overlap) return false;
  const unionMin = (Math.max(a.endMs, b.endMs) - Math.min(a.startMs, b.startMs)) / MS_PER_MIN;
  return a.durationMin + b.durationMin > unionMin + ELAPSED_TOLERANCE_MIN;
}

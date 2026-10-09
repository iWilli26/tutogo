import type { ReactNode } from "react";
import { STATUS_META } from "@/domain/status";
import type { SessionStatus } from "@/db/schema";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.tone}`}
    >
      {meta.emoji} {meta.label}
    </span>
  );
}

export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200"
    >
      {message}
    </p>
  );
}

export const primaryButton =
  "inline-flex w-full items-center justify-center rounded-2xl bg-brand-600 px-5 py-4 text-base font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto";
export const secondaryButton =
  "inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-50";
export const inputClass =
  "w-full rounded-2xl border-0 bg-brand-50 px-4 py-3 text-base ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-500 focus:outline-none";

import Link from "next/link";
import { formatMinutes } from "@/domain/duration";
import { StatusBadge } from "@/components/ui";
import type { SessionView } from "@/server/queries";

export function formatDate(date: Date): string {
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function SessionRow({
  view,
  counterpart,
  href,
}: {
  view: SessionView;
  counterpart: "tutee" | "tutor";
  href: string;
}) {
  const { session } = view;
  const other = counterpart === "tutee" ? view.tuteeName : view.tutorName;
  const duration =
    session.tutorDurationMin === null
      ? `Code ${session.code}`
      : formatMinutes(session.tutorDurationMin);
  return (
    <Link
      href={href}
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3 transition hover:bg-brand-100"
    >
      <span className="font-semibold">
        {view.subjectName} — {other}
      </span>
      <span className="flex items-center gap-3 text-sm text-slate-600">
        <span>{formatDate(session.createdAt)}</span>
        <span className="font-semibold">{duration}</span>
        <StatusBadge status={session.status} />
      </span>
    </Link>
  );
}

import Link from "next/link";
import { getDb } from "@/db/client";
import { Card, primaryButton, secondaryButton } from "@/components/ui";
import { SessionRow } from "@/components/SessionRow";
import { formatTotalHours } from "@/domain/duration";
import { requireRole } from "@/server/auth/session";
import { listSessionViews } from "@/server/queries";
import { getTutorTotals } from "@/server/stats";

export default async function TutorHome() {
  const tutor = await requireRole("TUTOR");
  const db = getDb();
  const totals = await getTutorTotals(db, tutor.id);
  const recent = await listSessionViews(db, { tutorId: tutor.id, limit: 6 });
  const open = recent.filter((v) => v.session.tutorDeclaredAt === null);

  return (
    <>
      <Card className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <p className="text-lg font-medium text-brand-100">Bonjour, {tutor.name} !</p>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-brand-100">
          Mes heures validées
        </p>
        <p className="text-6xl font-extrabold tracking-tight">
          {formatTotalHours(totals.validatedMinutes)}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-brand-100">
          <span>
            Cette semaine : <b className="text-white">{formatTotalHours(totals.weekMinutes)}</b>
          </span>
          <span>
            Séances validées : <b className="text-white">{totals.validatedCount}</b>
          </span>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold">Nouvelle séance</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/tutor/prepare" className={primaryButton}>
            + PRÉPARER UNE SÉANCE
          </Link>
          <Link href="/tutor/finish" className={`${secondaryButton} py-4 text-base`}>
            Terminer une séance
          </Link>
        </div>
        {open.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-semibold text-slate-500">Séances à terminer</p>
            {open.map((v) => (
              <Link
                key={v.session.id}
                href={`/tutor/sessions/${v.session.id}`}
                className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 hover:bg-brand-100"
              >
                <span className="font-semibold">
                  {v.subjectName} — {v.tuteeName}
                </span>
                <span className="rounded-lg bg-white px-3 py-1 font-mono text-lg font-bold tracking-widest text-brand-700">
                  {v.session.code}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold">Mes dernières séances</h2>
        {recent.length === 0 ? (
          <p className="text-slate-500">Aucune séance pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((v) => (
              <SessionRow
                key={v.session.id}
                view={v}
                counterpart="tutee"
                href={`/tutor/sessions/${v.session.id}`}
              />
            ))}
          </div>
        )}
        <Link
          href="/tutor/sessions"
          className="mt-4 inline-block text-sm font-semibold text-brand-700"
        >
          Tout l'historique →
        </Link>
      </Card>
    </>
  );
}

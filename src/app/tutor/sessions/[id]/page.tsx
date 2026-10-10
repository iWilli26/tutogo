import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { Card, StatusBadge, primaryButton } from "@/components/ui";
import { formatDate } from "@/components/SessionRow";
import { formatMinutes } from "@/domain/duration";
import { requireRole } from "@/server/auth/session";
import { listSessionViews } from "@/server/queries";

export default async function TutorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const tutor = await requireRole("TUTOR");
  const { id } = await params;
  const [view] = await listSessionViews(getDb(), { tutorId: tutor.id, sessionId: id });
  if (!view) notFound();
  const { session } = view;

  if (session.tutorDeclaredAt === null) {
    return (
      <Card className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Séance TutoGO
        </p>
        <p className="mt-2 text-xl font-bold">
          {view.subjectName} — {view.tuteeName}
        </p>
        <p className="mt-6 text-sm text-slate-500">Code de séance</p>
        <p className="font-mono text-8xl font-extrabold tracking-[0.2em] text-brand-700">
          {session.code}
        </p>
        <p className="mx-auto mt-6 max-w-md text-slate-600">
          Retiens ce code ou note-le sur papier. Range ton téléphone : tu en auras besoin uniquement
          après la séance, en dehors de l'école.
        </p>
        <Link href={`/tutor/finish?code=${session.code}`} className={`${primaryButton} mt-6`}>
          La séance est terminée
        </Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">
          {view.subjectName} — {view.tuteeName}
        </h1>
        <StatusBadge status={session.status} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Date</dt>
          <dd className="font-semibold">{formatDate(session.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Durée déclarée</dt>
          <dd className="font-semibold">{formatMinutes(session.tutorDurationMin ?? 0)}</dd>
        </div>
        {session.status === "VALIDATED" && (
          <div>
            <dt className="text-slate-500">Heures créditées</dt>
            <dd className="font-semibold text-emerald-700">
              {formatMinutes(session.validatedMinutes)}
            </dd>
          </div>
        )}
      </dl>
      <p className="rounded-2xl bg-brand-50 p-4 text-sm">
        {session.status === "PENDING" && "En attente de la confirmation de ton tutoré."}
        {session.status === "VALIDATED" &&
          "Séance validée : les heures ont été ajoutées à ton total."}
        {session.status === "TO_REVIEW" &&
          "Séance en vérification par un responsable TutoGO. Aucune heure n'est ajoutée pour l'instant."}
        {session.status === "REFUSED" && "Séance refusée par un responsable TutoGO."}
      </p>
    </Card>
  );
}

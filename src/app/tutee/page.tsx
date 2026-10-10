import { getDb } from "@/db/client";
import { ConfirmForm } from "@/components/ConfirmForm";
import { SessionRow, formatDate } from "@/components/SessionRow";
import { Card } from "@/components/ui";
import { formatMinutes } from "@/domain/duration";
import { requireRole } from "@/server/auth/session";
import { listSessionViews } from "@/server/queries";

export default async function TuteeHome() {
  const tutee = await requireRole("TUTEE");
  const views = await listSessionViews(getDb(), { tuteeId: tutee.id });
  const toConfirm = views.filter(
    (v) => v.session.tutorDeclaredAt !== null && v.tuteeParticipated === null,
  );
  const history = views.filter(
    (v) => v.session.tutorDeclaredAt !== null && v.tuteeParticipated !== null,
  );

  return (
    <>
      <h1 className="text-2xl font-extrabold">Bonjour, {tutee.name} !</h1>
      {toConfirm.length === 0 ? (
        <Card>
          <p className="text-slate-500">Aucune séance à confirmer pour le moment. 🎉</p>
        </Card>
      ) : (
        toConfirm.map((v) => (
          <Card key={v.session.id} className="space-y-4 ring-2 ring-brand-500">
            <h2 className="text-lg font-bold">Une séance de tutorat a été déclarée</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Tuteur</dt>
                <dd className="font-semibold">{v.tutorName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Matière</dt>
                <dd className="font-semibold">{v.subjectName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Date</dt>
                <dd className="font-semibold">{formatDate(v.session.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Durée déclarée</dt>
                <dd className="font-semibold">{formatMinutes(v.session.tutorDurationMin ?? 0)}</dd>
              </div>
            </dl>
            <p className="text-lg font-bold">As-tu réellement participé à cette séance ?</p>
            <ConfirmForm sessionId={v.session.id} />
          </Card>
        ))
      )}
      <Card>
        <h2 className="mb-4 text-lg font-bold">Mon historique</h2>
        {history.length === 0 ? (
          <p className="text-slate-500">Aucune séance confirmée.</p>
        ) : (
          <div className="space-y-2">
            {history.map((v) => (
              <SessionRow key={v.session.id} view={v} counterpart="tutor" href="/tutee" />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

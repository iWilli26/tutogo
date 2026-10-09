import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { AnomalyList } from "@/components/AnomalyList";
import { DecideForm } from "@/components/DecideForm";
import { formatDate } from "@/components/SessionRow";
import { Card, StatusBadge } from "@/components/ui";
import { BUCKET_RANGES, formatMinutes } from "@/domain/duration";
import { listAnomalyViews, listSessionViews } from "@/server/queries";

const COMPARISON_LABEL = {
  MATCH: "🟢 Cohérent",
  MISMATCH: "🔴 Divergence",
  TUTEE_DENIED: "🔴 Le tutoré nie avoir participé",
} as const;

export default async function AdminSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const view = listSessionViews(db, { sessionId: id })[0];
  if (!view) notFound();
  const { session } = view;
  const sessionAnomalies = listAnomalyViews(db).filter((a) => a.anomaly.sessionId === id);
  const history = db.select().from(auditLogs).where(eq(auditLogs.entityId, id)).all();
  const bucketMax = view.tuteeBucket ? BUCKET_RANGES[view.tuteeBucket].max : Infinity;
  const suggested = Math.min(session.tutorDurationMin ?? 0, bucketMax);

  return (
    <>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold">
            {view.subjectName} — {view.tutorName} → {view.tuteeName}
          </h1>
          <StatusBadge status={session.status} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Identifiant</dt>
            <dd className="font-mono text-xs">{session.id}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Créée le</dt>
            <dd className="font-semibold">{formatDate(session.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Déclaration du tuteur</dt>
            <dd className="font-semibold">
              {session.tutorDurationMin === null
                ? "Pas encore déclarée"
                : `${formatMinutes(session.tutorDurationMin)} (${formatDate(session.tutorDeclaredAt as Date)})`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Déclaration du tutoré</dt>
            <dd className="font-semibold">
              {view.tuteeParticipated === null
                ? "Pas encore confirmée"
                : view.tuteeParticipated
                  ? `A participé — ${view.tuteeBucket ? BUCKET_RANGES[view.tuteeBucket].label : ""}`
                  : "N'a pas participé"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Comparaison</dt>
            <dd className="font-semibold">
              {session.comparison ? COMPARISON_LABEL[session.comparison] : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Heures créditées</dt>
            <dd className="font-semibold">{formatMinutes(session.validatedMinutes)}</dd>
          </div>
        </dl>
        {session.statusReason && (
          <p className="rounded-2xl bg-brand-50 p-4 text-sm">
            <b>Motif :</b> {session.statusReason}
          </p>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Décision administrateur</h2>
        <DecideForm
          sessionId={session.id}
          maxMinutes={session.tutorDurationMin}
          suggestedMinutes={suggested}
        />
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Anomalies liées</h2>
        <AnomalyList items={sessionAnomalies} />
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Journal de la séance</h2>
        <ul className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id}>
              <span className="text-slate-500">{formatDate(h.at)}</span> — <b>{h.action}</b>{" "}
              <span className="text-slate-500">{h.payload}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

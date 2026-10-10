import Link from "next/link";
import { getDb } from "@/db/client";
import { AnomalyList } from "@/components/AnomalyList";
import { SessionRow } from "@/components/SessionRow";
import { Card } from "@/components/ui";
import { formatTotalHours } from "@/domain/duration";
import { listAnomalyViews, listSessionViews, scanStaleSessions } from "@/server/queries";
import { getAdminStats, getLeaderboard } from "@/server/stats";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function AdminHome() {
  const db = getDb();
  await scanStaleSessions(db);
  const stats = await getAdminStats(db);
  const board = await getLeaderboard(db);
  const review = await listSessionViews(db, { statuses: ["TO_REVIEW"], limit: 10 });
  const anomalies = (await listAnomalyViews(db, "OPEN")).slice(0, 5);

  const tiles: [string, string][] = [
    ["Tuteurs", String(stats.tutors)],
    ["Tutorés", String(stats.tutees)],
    ["Séances", String(stats.sessions)],
    ["Heures déclarées", formatTotalHours(stats.totalMinutes)],
    ["Heures validées", formatTotalHours(stats.validatedMinutes)],
    ["Heures en attente", formatTotalHours(stats.pendingMinutes)],
    ["Séances signalées", String(stats.flaggedSessions)],
    ["Anomalies ouvertes", String(stats.openAnomalies)],
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label} className="!p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-3xl font-extrabold text-brand-700">{value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Classement (heures validées)</h2>
        <ol className="space-y-2">
          {board.map((row, i) => (
            <li
              key={row.tutorId}
              className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3"
            >
              <span className="font-semibold">
                {MEDALS[i] ?? `${i + 1}.`} {row.name}
              </span>
              <span className="font-bold text-emerald-700">{formatTotalHours(row.minutes)}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Séances à vérifier</h2>
        {review.length === 0 ? (
          <p className="text-slate-500">Rien à vérifier.</p>
        ) : (
          <div className="space-y-2">
            {review.map((v) => (
              <SessionRow
                key={v.session.id}
                view={v}
                counterpart="tutee"
                href={`/admin/sessions/${v.session.id}`}
              />
            ))}
          </div>
        )}
      </Card>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Anomalies récentes</h2>
          <Link href="/admin/anomalies" className="text-sm font-semibold text-brand-700">
            Tout voir →
          </Link>
        </div>
        <AnomalyList items={anomalies} />
      </Card>
    </>
  );
}

import Link from "next/link";
import { closeAnomalyAction } from "@/app/actions/admin";
import { formatDate } from "@/components/SessionRow";
import { secondaryButton } from "@/components/ui";
import { ANOMALY_LABELS } from "@/domain/status";
import type { listAnomalyViews } from "@/server/queries";

type AnomalyView = ReturnType<typeof listAnomalyViews>[number];

export function AnomalyList({ items }: { items: AnomalyView[] }) {
  if (items.length === 0) return <p className="text-slate-500">Aucune anomalie.</p>;
  return (
    <ul className="space-y-3">
      {items.map(({ anomaly, userName }) => (
        <li key={anomaly.id} className="rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-orange-800">{ANOMALY_LABELS[anomaly.type]}</span>
            <span className="text-xs text-slate-500">
              {formatDate(anomaly.createdAt)} ·{" "}
              {anomaly.status === "OPEN"
                ? "Ouverte"
                : anomaly.status === "RESOLVED"
                  ? "Traitée"
                  : "Ignorée"}
            </span>
          </div>
          <p className="mt-1 text-sm">{anomaly.details}</p>
          {userName && <p className="mt-1 text-xs text-slate-500">Compte concerné : {userName}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {anomaly.sessionId && (
              <Link href={`/admin/sessions/${anomaly.sessionId}`} className={secondaryButton}>
                Ouvrir la séance
              </Link>
            )}
            {anomaly.status === "OPEN" &&
              (["RESOLVED", "DISMISSED"] as const).map((status) => (
                <form key={status} action={closeAnomalyAction}>
                  <input type="hidden" name="id" value={anomaly.id} />
                  <input type="hidden" name="status" value={status} />
                  <button className={secondaryButton}>
                    {status === "RESOLVED" ? "Marquer traitée" : "Ignorer"}
                  </button>
                </form>
              ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

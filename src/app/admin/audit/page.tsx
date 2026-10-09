import { getDb } from "@/db/client";
import { formatDate } from "@/components/SessionRow";
import { Card } from "@/components/ui";
import { listAuditLogs } from "@/server/queries";

export default function AuditPage() {
  const logs = listAuditLogs(getDb());
  return (
    <Card>
      <h1 className="mb-4 text-2xl font-extrabold">Journal des actions</h1>
      <p className="mb-4 text-sm text-slate-500">
        Journal en ajout seul : aucune entrée ne peut être modifiée ni supprimée.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="pr-4">Auteur</th>
              <th className="pr-4">Action</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(({ log, actorName }) => (
              <tr key={log.id} className="border-t border-brand-100 align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{formatDate(log.at)}</td>
                <td className="pr-4">{actorName ?? "Système"}</td>
                <td className="pr-4 font-semibold">{log.action}</td>
                <td className="break-all text-slate-500">
                  {log.entityType}:{log.entityId.slice(0, 8)} {log.payload}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

import { getDb } from "@/db/client";
import { AnomalyList } from "@/components/AnomalyList";
import { Card } from "@/components/ui";
import { listAnomalyViews, scanStaleSessions } from "@/server/queries";

export default function AnomaliesPage() {
  const db = getDb();
  scanStaleSessions(db);
  return (
    <Card>
      <h1 className="mb-5 text-2xl font-extrabold">Anomalies</h1>
      <AnomalyList items={listAnomalyViews(db)} />
    </Card>
  );
}

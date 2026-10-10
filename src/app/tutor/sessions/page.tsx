import { getDb } from "@/db/client";
import { Card } from "@/components/ui";
import { SessionRow } from "@/components/SessionRow";
import { requireRole } from "@/server/auth/session";
import { listSessionViews } from "@/server/queries";

export default async function TutorHistory() {
  const tutor = await requireRole("TUTOR");
  const views = await listSessionViews(getDb(), { tutorId: tutor.id });
  return (
    <Card>
      <h1 className="mb-5 text-2xl font-extrabold">Mon historique</h1>
      {views.length === 0 ? (
        <p className="text-slate-500">Aucune séance.</p>
      ) : (
        <div className="space-y-2">
          {views.map((v) => (
            <SessionRow
              key={v.session.id}
              view={v}
              counterpart="tutee"
              href={`/tutor/sessions/${v.session.id}`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

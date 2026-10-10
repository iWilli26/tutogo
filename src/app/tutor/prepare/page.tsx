import { getDb } from "@/db/client";
import { PrepareForm } from "@/components/PrepareForm";
import { Card } from "@/components/ui";
import { requireRole } from "@/server/auth/session";
import { listSubjects, listTuteesOf } from "@/server/queries";

export default async function PreparePage() {
  const tutor = await requireRole("TUTOR");
  const db = getDb();
  const tutees = await listTuteesOf(db, tutor.id);
  const subjects = await listSubjects(db);
  return (
    <Card>
      <h1 className="mb-5 text-2xl font-extrabold">Préparer une séance</h1>
      {tutees.length === 0 ? (
        <p className="text-slate-500">
          Aucun tutoré ne t'est associé pour le moment. Contacte un responsable TutoGO.
        </p>
      ) : (
        <PrepareForm tutees={tutees} subjects={subjects} />
      )}
    </Card>
  );
}

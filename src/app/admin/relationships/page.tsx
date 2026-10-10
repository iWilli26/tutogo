import { getDb } from "@/db/client";
import { unlinkAction } from "@/app/actions/admin";
import { LinkForm, SubjectForm } from "@/components/AdminForms";
import { Card, secondaryButton } from "@/components/ui";
import { listRelationships, listSubjects, listUsers } from "@/server/queries";

export default async function RelationshipsPage() {
  const db = getDb();
  const users = (await listUsers(db)).filter((u) => u.active);
  const relationships = await listRelationships(db);
  const subjects = await listSubjects(db);
  return (
    <>
      <Card>
        <h1 className="mb-4 text-2xl font-extrabold">Associer un tuteur et un tutoré</h1>
        <LinkForm
          tutors={users.filter((u) => u.role === "TUTOR")}
          tutees={users.filter((u) => u.role === "TUTEE")}
        />
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Associations</h2>
        <ul className="space-y-2">
          {relationships.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3"
            >
              <span className={r.active ? "" : "text-slate-400 line-through"}>
                {r.tutorName} → {r.tuteeName}
              </span>
              {r.active && (
                <form action={unlinkAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={secondaryButton}>Dissocier</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Matières</h2>
        <p className="mb-4 text-sm text-slate-600">{subjects.map((s) => s.name).join(" · ")}</p>
        <SubjectForm />
      </Card>
    </>
  );
}

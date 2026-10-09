import { getDb } from "@/db/client";
import { toggleUserAction } from "@/app/actions/admin";
import { CreateUserForm } from "@/components/AdminForms";
import { Card, secondaryButton } from "@/components/ui";
import { listUsers } from "@/server/queries";

const ROLE_LABEL = { TUTOR: "Tuteur", TUTEE: "Tutoré", ADMIN: "Admin" } as const;

export default function UsersPage() {
  const all = listUsers(getDb());
  return (
    <>
      <Card>
        <h1 className="mb-4 text-2xl font-extrabold">Nouvel utilisateur</h1>
        <CreateUserForm />
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Utilisateurs ({all.length})</h2>
        <ul className="space-y-2">
          {all.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3"
            >
              <span>
                <b>{u.name}</b>{" "}
                <span className="text-sm text-slate-500">
                  {u.email} · {ROLE_LABEL[u.role]}
                </span>
              </span>
              <form action={toggleUserAction}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="active" value={String(!u.active)} />
                <button className={secondaryButton}>{u.active ? "Désactiver" : "Réactiver"}</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

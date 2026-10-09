import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import type { Role } from "@/db/schema";

const NAV: Record<Role, { href: string; label: string }[]> = {
  TUTOR: [
    { href: "/tutor", label: "Accueil" },
    { href: "/tutor/finish", label: "Terminer une séance" },
    { href: "/tutor/sessions", label: "Historique" },
  ],
  TUTEE: [{ href: "/tutee", label: "Mes séances" }],
  ADMIN: [
    { href: "/admin", label: "Tableau de bord" },
    { href: "/admin/sessions", label: "Séances" },
    { href: "/admin/anomalies", label: "Anomalies" },
    { href: "/admin/users", label: "Utilisateurs" },
    { href: "/admin/relationships", label: "Associations" },
    { href: "/admin/audit", label: "Journal" },
  ],
};

export function Shell({ role, name, children }: { role: Role; name: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-brand-700">
          🌱 TutoGO
        </Link>
        <form action={logout} className="flex items-center gap-3 text-sm text-slate-500">
          <span>{name}</span>
          <button className="rounded-xl px-3 py-1.5 font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50">
            Déconnexion
          </button>
        </form>
      </header>
      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {NAV[role].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="space-y-5">{children}</main>
    </div>
  );
}

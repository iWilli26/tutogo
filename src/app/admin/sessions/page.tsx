import Link from "next/link";
import { getDb } from "@/db/client";
import { SessionRow } from "@/components/SessionRow";
import { Card } from "@/components/ui";
import { SESSION_STATUSES, type SessionStatus } from "@/db/schema";
import { STATUS_META } from "@/domain/status";
import { listSessionViews } from "@/server/queries";

export default async function AdminSessions({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = SESSION_STATUSES.find((s) => s === status) as SessionStatus | undefined;
  const views = listSessionViews(getDb(), filter ? { statuses: [filter] } : {});
  return (
    <Card>
      <h1 className="mb-4 text-2xl font-extrabold">Séances</h1>
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/sessions"
          className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold"
        >
          Toutes
        </Link>
        {SESSION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/sessions?status=${s}`}
            className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold"
          >
            {STATUS_META[s].emoji} {STATUS_META[s].label}
          </Link>
        ))}
      </div>
      <div className="space-y-2">
        {views.map((v) => (
          <SessionRow
            key={v.session.id}
            view={v}
            counterpart="tutee"
            href={`/admin/sessions/${v.session.id}`}
          />
        ))}
      </div>
      <Link
        href="/admin/export"
        prefetch={false}
        className="mt-6 inline-block text-sm font-semibold text-brand-700"
      >
        Exporter (CSV) →
      </Link>
    </Card>
  );
}

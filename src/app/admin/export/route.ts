import { getDb } from "@/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { exportSessionsCsv } from "@/server/admin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  return new Response(exportSessionsCsv(getDb(), user.id), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="tutogo-seances.csv"',
    },
  });
}

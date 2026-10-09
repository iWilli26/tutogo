import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { requireRole } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <Shell role="ADMIN" name={user.name}>
      {children}
    </Shell>
  );
}

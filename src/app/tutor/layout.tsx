import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { requireRole } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function TutorLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("TUTOR");
  return (
    <Shell role="TUTOR" name={user.name}>
      {children}
    </Shell>
  );
}

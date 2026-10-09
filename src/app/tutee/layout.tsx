import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { requireRole } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function TuteeLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("TUTEE");
  return (
    <Shell role="TUTEE" name={user.name}>
      {children}
    </Shell>
  );
}

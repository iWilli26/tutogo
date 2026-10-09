import { DeclareForm } from "@/components/DeclareForm";
import { Card } from "@/components/ui";
import { requireRole } from "@/server/auth/session";

export default async function FinishPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requireRole("TUTOR");
  const { code } = await searchParams;
  return (
    <Card>
      <h1 className="mb-5 text-2xl font-extrabold">Terminer une séance</h1>
      <DeclareForm initialCode={code?.slice(0, 8) ?? ""} />
    </Card>
  );
}

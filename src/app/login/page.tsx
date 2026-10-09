import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Card } from "@/components/ui";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/server/demo";
import { HOME_BY_ROLE, getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_BY_ROLE[user.role]);
  const showDemo = process.env.NODE_ENV !== "production";
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-1 text-center text-4xl font-extrabold tracking-tight text-brand-700">
        🌱 TutoGO
      </h1>
      <p className="mb-8 text-center text-slate-500">Le suivi du tutorat bénévole au CIMF</p>
      <Card>
        <LoginForm demoAccounts={showDemo ? [...DEMO_ACCOUNTS] : []} demoPassword={DEMO_PASSWORD} />
      </Card>
    </div>
  );
}

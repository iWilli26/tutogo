import { redirect } from "next/navigation";
import { HOME_BY_ROLE, getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? HOME_BY_ROLE[user.role] : "/login");
}

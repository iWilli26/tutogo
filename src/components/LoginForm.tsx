"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";
import { FormError, inputClass, primaryButton } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

interface DemoAccount {
  email: string;
  name: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = { TUTOR: "Tuteur", TUTEE: "Tutoré", ADMIN: "Admin" };

export function LoginForm({
  demoAccounts,
  demoPassword,
}: {
  demoAccounts: DemoAccount[];
  demoPassword: string;
}) {
  const [state, action] = useActionState(login, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Mot de passe</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <FormError message={state.error} />
        <SubmitButton className={primaryButton}>Se connecter</SubmitButton>
      </form>
      {demoAccounts.length > 0 && (
        <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <p className="mb-3 text-sm font-semibold text-brand-700">
            Prototype : comptes de démonstration (connexion CIMF non configurée)
          </p>
          <div className="flex flex-wrap gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(demoPassword);
                }}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-brand-100 hover:bg-brand-100"
              >
                {account.name} · {ROLE_LABEL[account.role]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

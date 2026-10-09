"use client";

import { useActionState } from "react";
import { addSubjectAction, createUserAction, linkAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError, inputClass, primaryButton } from "@/components/ui";

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="name" placeholder="Prénom Nom" required className={inputClass} />
      <input
        name="email"
        type="email"
        placeholder="prenom.nom@cimf.fr"
        required
        className={inputClass}
      />
      <select name="role" className={inputClass} defaultValue="TUTOR">
        <option value="TUTOR">Tuteur</option>
        <option value="TUTEE">Tutoré</option>
        <option value="ADMIN">Administrateur</option>
      </select>
      <input
        name="password"
        type="password"
        placeholder="Mot de passe initial (8+)"
        required
        minLength={8}
        className={inputClass}
      />
      <div className="sm:col-span-2 space-y-3">
        <FormError message={state.error} />
        <SubmitButton className={primaryButton}>Créer le compte</SubmitButton>
      </div>
    </form>
  );
}

interface Option {
  id: string;
  name: string;
}

export function LinkForm({ tutors, tutees }: { tutors: Option[]; tutees: Option[] }) {
  const [state, action] = useActionState(linkAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <select name="tutorId" required className={inputClass} defaultValue="">
        <option value="" disabled>
          Tuteur…
        </option>
        {tutors.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select name="tuteeId" required className={inputClass} defaultValue="">
        <option value="" disabled>
          Tutoré…
        </option>
        {tutees.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="sm:col-span-2 space-y-3">
        <FormError message={state.error} />
        <SubmitButton className={primaryButton}>Associer</SubmitButton>
      </div>
    </form>
  );
}

export function SubjectForm() {
  const [state, action] = useActionState(addSubjectAction, {});
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row">
      <input name="name" placeholder="Nouvelle matière" required className={inputClass} />
      <SubmitButton className={primaryButton}>Ajouter</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

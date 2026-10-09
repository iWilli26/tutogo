"use client";

import { useActionState, useState } from "react";
import { prepareAction } from "@/app/actions/tutor";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError, primaryButton } from "@/components/ui";

interface Option {
  id: string;
  name: string;
}

function Choice({
  option,
  selected,
  onSelect,
}: {
  option: Option;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-2xl px-5 py-4 text-left text-base font-bold ring-1 transition ${
        selected
          ? "bg-brand-600 text-white ring-brand-600"
          : "bg-brand-50 text-slate-800 ring-brand-100 hover:bg-brand-100"
      }`}
    >
      {option.name}
    </button>
  );
}

export function PrepareForm({ tutees, subjects }: { tutees: Option[]; subjects: Option[] }) {
  const [state, action] = useActionState(prepareAction, {});
  const [tuteeId, setTuteeId] = useState(tutees.length === 1 ? (tutees[0]?.id ?? "") : "");
  const [subjectId, setSubjectId] = useState("");

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="tuteeId" value={tuteeId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <div>
        <h2 className="mb-3 text-lg font-bold">1. Mon tutoré</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {tutees.map((t) => (
            <Choice
              key={t.id}
              option={t}
              selected={tuteeId === t.id}
              onSelect={() => setTuteeId(t.id)}
            />
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-bold">2. La matière</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {subjects.map((s) => (
            <Choice
              key={s.id}
              option={s}
              selected={subjectId === s.id}
              onSelect={() => setSubjectId(s.id)}
            />
          ))}
        </div>
      </div>
      <FormError message={state.error} />
      <SubmitButton className={`${primaryButton} disabled:cursor-not-allowed`}>
        PRÉPARER LA SÉANCE
      </SubmitButton>
    </form>
  );
}

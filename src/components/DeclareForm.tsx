"use client";

import { useActionState, useState } from "react";
import { declareAction } from "@/app/actions/tutor";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError, inputClass, primaryButton } from "@/components/ui";
import { formatMinutes } from "@/domain/duration";

const PRESETS = [30, 45, 60, 75, 90, 120];

export function DeclareForm({ initialCode }: { initialCode: string }) {
  const [state, action] = useActionState(declareAction, {});
  const [duration, setDuration] = useState(60);

  return (
    <form action={action} className="space-y-6">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Code de séance</span>
        <input
          name="code"
          defaultValue={initialCode}
          required
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="K7P4"
          className={`${inputClass} text-center font-mono text-3xl font-extrabold uppercase tracking-[0.4em]`}
        />
      </label>
      <div>
        <p className="mb-2 text-sm font-semibold">Durée réelle de la séance</p>
        <input type="hidden" name="durationMin" value={duration} />
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={duration === p}
              onClick={() => setDuration(p)}
              className={`rounded-2xl px-3 py-3 font-bold ring-1 ${
                duration === p
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "bg-brand-50 ring-brand-100 hover:bg-brand-100"
              }`}
            >
              {formatMinutes(p)}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Moins 5 minutes"
            onClick={() => setDuration((d) => Math.max(10, d - 5))}
            className="h-12 w-12 rounded-full bg-brand-50 text-2xl font-bold ring-1 ring-brand-100"
          >
            −
          </button>
          <span className="min-w-28 text-center text-2xl font-extrabold">
            {formatMinutes(duration)}
          </span>
          <button
            type="button"
            aria-label="Plus 5 minutes"
            onClick={() => setDuration((d) => Math.min(240, d + 5))}
            className="h-12 w-12 rounded-full bg-brand-50 text-2xl font-bold ring-1 ring-brand-100"
          >
            +
          </button>
        </div>
      </div>
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
        Ta déclaration sera comparée à celle de ton tutoré. Les heures ne sont ajoutées qu'une fois
        la séance validée.
      </p>
      <FormError message={state.error} />
      <SubmitButton className={primaryButton}>DÉCLARER LA SÉANCE TERMINÉE</SubmitButton>
    </form>
  );
}

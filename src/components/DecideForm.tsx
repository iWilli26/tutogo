"use client";

import { useActionState } from "react";
import { decideAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError, inputClass } from "@/components/ui";

export function DecideForm({
  sessionId,
  maxMinutes,
  suggestedMinutes,
}: {
  sessionId: string;
  maxMinutes: number | null;
  suggestedMinutes: number;
}) {
  const [state, action] = useActionState(decideAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      {maxMinutes !== null && (
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">
            Minutes créditées si validation (max {maxMinutes})
          </span>
          <input
            name="minutes"
            type="number"
            min={1}
            max={maxMinutes}
            defaultValue={suggestedMinutes}
            className={inputClass}
          />
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Justification (obligatoire, journalisée)</span>
        <textarea name="note" required maxLength={500} rows={2} className={inputClass} />
      </label>
      <FormError message={state.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        {maxMinutes !== null && (
          <SubmitButton
            name="decision"
            value="VALIDATE"
            className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
          >
            🟢 Valider
          </SubmitButton>
        )}
        <SubmitButton
          name="decision"
          value="REFUSE"
          className="rounded-2xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
        >
          🔴 Refuser
        </SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { confirmAction } from "@/app/actions/tutee";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/ui";
import { BUCKET_RANGES } from "@/domain/duration";
import { DURATION_BUCKETS } from "@/db/schema";

export function ConfirmForm({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState(confirmAction, {});
  const [bucket, setBucket] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Combien de temps a duré la séance, environ ?
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DURATION_BUCKETS.map((b) => (
            <label
              key={b}
              className={`cursor-pointer rounded-2xl px-3 py-3 text-center text-sm font-bold ring-1 ${
                bucket === b
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "bg-brand-50 ring-brand-100 hover:bg-brand-100"
              }`}
            >
              <input
                type="radio"
                name="bucket"
                value={b}
                checked={bucket === b}
                onChange={() => setBucket(b)}
                className="sr-only"
              />
              {BUCKET_RANGES[b].label}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={state.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SubmitButton
          name="participated"
          value="yes"
          className="rounded-2xl bg-emerald-600 px-5 py-4 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          ✓ OUI, JE CONFIRME
        </SubmitButton>
        <SubmitButton
          name="participated"
          value="no"
          className="rounded-2xl bg-white px-5 py-4 text-base font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
        >
          ✕ NON
        </SubmitButton>
      </div>
    </form>
  );
}

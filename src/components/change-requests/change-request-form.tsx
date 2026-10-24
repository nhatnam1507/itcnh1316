"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitChangeRequestAction } from "@/app/people/[id]/request-change/actions";
import { describedBy, FieldError } from "@/components/admin/field-error";
import { DateInput } from "@/components/forms/date-input";
import type { DirectoryPerson } from "@/features/people/people-queries";
import type { ActionResult } from "@/lib/action-result";
import { formatDate, formatPhone } from "@/lib/format";

/** Each field shows the current value as its placeholder, so it is clear what is being changed. */
export function ChangeRequestForm({ person }: { person: DirectoryPerson }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(submitChangeRequestAction, null);

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <p>{state.message}</p>
        <p>The admin will review it. Nothing changes until it is approved.</p>
        <Link href="/">← Back to the console</Link>
      </div>
    );
  }

  const errors = state?.fieldErrors;
  const value = (name: string) => state?.values?.[name] ?? "";

  return (
    <form action={formAction} className="person-form" noValidate>
      <input type="hidden" name="person_id" value={person.id} />
      <p className="hud-label">Fill in only the fields that should change. Blank fields stay as they are.</p>
      <div className="person-form-fields">
        <div className="field">
          <label htmlFor="proposed_full_name">New full name</label>
          <input
            id="proposed_full_name"
            name="proposed_full_name"
            maxLength={120}
            placeholder={person.full_name}
            defaultValue={value("proposed_full_name")}
            aria-invalid={errors?.proposed_full_name ? true : undefined}
            aria-describedby={describedBy(errors, "proposed_full_name")}
          />
          <FieldError errors={errors} name="proposed_full_name" />
        </div>
        <div className="field">
          <label htmlFor="proposed_date_of_birth">New date of birth</label>
          <DateInput
            id="proposed_date_of_birth"
            name="proposed_date_of_birth"
            placeholder={formatDate(person.date_of_birth)}
            defaultValue={value("proposed_date_of_birth")}
            aria-invalid={errors?.proposed_date_of_birth ? true : undefined}
            aria-describedby={describedBy(errors, "proposed_date_of_birth")}
          />
          <FieldError errors={errors} name="proposed_date_of_birth" />
        </div>
        <div className="field">
          <label htmlFor="proposed_mobile_phone">New mobile phone</label>
          <input
            id="proposed_mobile_phone"
            name="proposed_mobile_phone"
            type="tel"
            inputMode="tel"
            placeholder={formatPhone(person.mobile_phone)}
            defaultValue={value("proposed_mobile_phone")}
            aria-invalid={errors?.proposed_mobile_phone ? true : undefined}
            aria-describedby={describedBy(errors, "proposed_mobile_phone")}
          />
          <FieldError errors={errors} name="proposed_mobile_phone" />
        </div>
        <div className="field">
          <label htmlFor="proposed_address">New address</label>
          <textarea
            id="proposed_address"
            name="proposed_address"
            rows={3}
            maxLength={300}
            placeholder={person.address}
            defaultValue={value("proposed_address")}
            aria-invalid={errors?.proposed_address ? true : undefined}
            aria-describedby={describedBy(errors, "proposed_address")}
          />
          <FieldError errors={errors} name="proposed_address" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="requester_note">Note for the admin (optional)</label>
        <textarea
          id="requester_note"
          name="requester_note"
          rows={2}
          maxLength={500}
          defaultValue={value("requester_note")}
          aria-invalid={errors?.requester_note ? true : undefined}
          aria-describedby={describedBy(errors, "requester_note")}
        />
        <FieldError errors={errors} name="requester_note" />
      </div>
      <FieldError errors={errors} name="form" />
      {state && !state.ok && state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="form-actions">
        <Link href="/" className="btn">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Transmitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

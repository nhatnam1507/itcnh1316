"use client";

import { useActionState, useRef } from "react";
import { deletePersonAction } from "@/app/admin/(console)/people/actions";
import type { ActionResult } from "@/lib/action-result";
import { describedBy, FieldError } from "./field-error";

export function DeletePersonDialog({ personId, fullName }: { personId: string; fullName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, deleting] = useActionState<ActionResult | null, FormData>(deletePersonAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <>
      <button type="button" className="btn btn-danger" onClick={() => dialogRef.current?.showModal()}>
        Delete person
      </button>
      <dialog ref={dialogRef} className="confirm-dialog panel-frame" aria-labelledby="delete-title">
        <form action={formAction} className="unlock-form">
          <h2 id="delete-title" className="badge-alert">
            Delete {fullName}?
          </h2>
          <p>
            This permanently removes the record and its pin. Their pending change requests are deleted too. This cannot be
            undone.
          </p>
          <input type="hidden" name="id" value={personId} />
          <div className="field">
            <label htmlFor="confirmation_name">Type the full name to confirm</label>
            <input
              id="confirmation_name"
              name="confirmation_name"
              autoComplete="off"
              required
              aria-invalid={errors?.confirmation_name ? true : undefined}
              aria-describedby={describedBy(errors, "confirmation_name")}
            />
            <FieldError errors={errors} name="confirmation_name" />
          </div>
          {state && !state.ok && state.error ? (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

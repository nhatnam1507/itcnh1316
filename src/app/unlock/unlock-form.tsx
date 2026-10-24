"use client";

import { useActionState } from "react";
import { unlockAction, type UnlockState } from "./actions";

export function UnlockForm() {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(unlockAction, null);

  return (
    <form action={formAction} className="unlock-form">
      <div className="field">
        <label htmlFor="passcode">Class passcode</label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
          autoFocus
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "unlock-error" : undefined}
        />
      </div>
      {state?.error ? (
        <p id="unlock-error" role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Verifying…" : "Unlock"}
      </button>
    </form>
  );
}

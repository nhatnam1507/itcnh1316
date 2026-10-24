"use client";

import { useActionState } from "react";
import { adminLoginAction, type AdminLoginState } from "./actions";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(adminLoginAction, null);

  return (
    <form action={formAction} className="unlock-form">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={320} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </div>
      {state?.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Authenticating…" : "Log in"}
      </button>
    </form>
  );
}

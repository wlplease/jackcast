"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { Wordmark } from "@/components/Wordmark";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="login">
      <form action={action}>
        <div className="wordmark">
          <Wordmark />
        </div>
        <label className="sr-only" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" placeholder="password" autoFocus autoComplete="current-password" required />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "…" : "Enter"}
        </button>
        {error && <div className="form-error" style={{ textAlign: "center" }}>{error}</div>}
      </form>
    </main>
  );
}

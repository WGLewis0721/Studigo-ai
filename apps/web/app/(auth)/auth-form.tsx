"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "@/lib/actions/auth";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="buttonPrimary authSubmit" type="submit" disabled={pending}>
      {pending ? "Working…" : label} <span aria-hidden="true">→</span>
    </button>
  );
}

export function AuthForm({
  mode,
  action,
  next
}: {
  mode: "signin" | "signup";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next: string;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});
  const isSignUp = mode === "signup";

  return (
    <form className="authForm" action={formAction}>
      <input type="hidden" name="next" value={next} />

      {isSignUp && (
        <label className="field">
          <span>Name</span>
          <input name="fullName" type="text" autoComplete="name" placeholder="Riley Chen" />
        </label>
      )}

      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@school.edu"
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={isSignUp ? 8 : undefined}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
        />
      </label>

      {state.error && (
        <p className="formError" role="alert">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="formNotice" role="status">
          {state.notice}
        </p>
      )}

      <SubmitButton label={isSignUp ? "Create account" : "Sign in"} />

      <p className="authSwitch">
        {isSignUp ? (
          <>
            Already have a Study Room? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}

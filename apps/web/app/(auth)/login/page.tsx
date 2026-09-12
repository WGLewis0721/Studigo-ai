import { GoogleSignIn } from "../google-sign-in";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { signInAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Sign in · Studigo" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="authTitle">Welcome back.</h1>
      <p className="authLede">Pick up where your last study session left off.</p>
      {error && <p className="formError" role="alert">Sign-in did not finish. Please try again.</p>}
      <GoogleSignIn next={next ?? "/app"} />
      <AuthForm mode="signin" action={signInAction} next={next ?? "/app"} />
    </>
  );
}

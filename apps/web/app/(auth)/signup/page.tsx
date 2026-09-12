import { GoogleSignIn } from "../google-sign-in";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { signUpAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Create an account · Studigo" };

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="authTitle">Start your first Study Room.</h1>
      <p className="authLede">
        Upload the study guide and the material it points at. Studigo does the rest.
      </p>
      {error && <p className="formError" role="alert">Sign-in did not finish. Please try again.</p>}
      <GoogleSignIn next={next ?? "/app"} />
      <AuthForm mode="signup" action={signUpAction} next={next ?? "/app"} />
    </>
  );
}

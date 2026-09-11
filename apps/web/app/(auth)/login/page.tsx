import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { signInAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Sign in · Studigo" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="authTitle">Welcome back.</h1>
      <p className="authLede">Pick up where your last study session left off.</p>
      <AuthForm mode="signin" action={signInAction} next={next ?? "/app"} />
    </>
  );
}

"use server";

import { appOrigin } from "@/lib/app-origin";
import { safeNext } from "@/lib/validation";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; notice?: string };

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  return { email, password };
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { error: "Sign-in is not available yet. Please try again later." };
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "That email and password don't match an account."
          : error.message
    };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { error: "Sign-in is not available yet. Please try again later." };
  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get("fullName") || "").trim();

  if (!email || !password) return { error: "Enter your email and a password." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${appOrigin()}/auth/callback`
    }
  });

  if (error) return { error: error.message };

  // With email confirmation switched on, there is no session yet.
  if (!data.session) {
    return { notice: `Check ${email} for a confirmation link, then sign in.` };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function signInGoogleAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: "Sign-in is not available yet. Please try again later." };
  }
  const supabase = await createServerSupabaseClient();
  const callback = new URL("/auth/callback", appOrigin());
  callback.searchParams.set("next", safeNext(formData.get("next")));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: callback.toString(), skipBrowserRedirect: true }
  });
  if (error || !data.url) return { error: "Google sign-in could not start. Please try again or use email." };
  redirect(data.url);
}

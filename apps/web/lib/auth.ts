import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** For pages and server actions: no session means back to sign-in. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers, which answer with 401 rather than a redirect. */
export async function requireApiUser() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { supabase, user: null, unauthorized: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { supabase, user: data.user, unauthorized: null } as const;
}

export function initialsFor(user: User) {
  const source = (user.user_metadata?.full_name as string | undefined) || user.email || "?";
  const parts = source.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

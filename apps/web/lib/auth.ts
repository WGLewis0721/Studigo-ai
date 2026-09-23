import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getUser(): Promise<User | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * TEMP: login gate disabled for open live testing. When there is no real
 * Supabase session we hand back a read-only guest identity instead of
 * redirecting to /login, so the app shell is reachable without an account.
 * Because every query is RLS-scoped to the session user, a guest sees an empty
 * shell (no rooms, no writes) — full functionality still needs a real account.
 * To restore the gate, delete GUEST_USER and re-enable `redirect("/login")`.
 */
const GUEST_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "guest@studigo.local",
  app_metadata: {},
  user_metadata: { full_name: "Guest" },
  aud: "authenticated",
  created_at: new Date(0).toISOString()
} as unknown as User;

/** For pages and server actions: no session falls back to a read-only guest. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) return GUEST_USER;
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

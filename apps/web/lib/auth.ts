import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { readBearer } from "./bearer-auth";
import { serverLocalSession } from './local-beta-context';

export async function getUser(): Promise<User | null> {
  const local = await serverLocalSession();
  if (local) return { id:local.id, app_metadata:{},user_metadata:{full_name:'Local beta'},aud:'local-beta',created_at:'2026-10-01T00:00:00Z',is_anonymous:true } as User;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * For pages and server actions. Middleware signs every visitor in — as a real
 * anonymous Supabase Auth user when they have no account — before a request
 * reaches here, so this should always resolve. The redirect is a fallback for
 * the rare request middleware didn't run in front of (e.g. local tooling).
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers, which answer with 401 rather than a redirect. */
export async function requireApiUser() {
  const bearer = readBearer((await headers()).get("authorization"));
  if (bearer.kind !== "absent") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase is not configured");
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: bearer.kind === "bearer" ? { Authorization: "Bearer " + bearer.token } : {} }
    });
    // A malformed or forged bearer cannot fall back to a logged-in cookie.
    const user = bearer.kind === "bearer" ? (await supabase.auth.getUser(bearer.token)).data.user : null;
    return user ? { supabase, user, unauthorized: null } as const
      : { supabase, user: null, unauthorized: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
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

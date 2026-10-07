import { createServerSupabaseClient } from "@/lib/supabase/server";
import { serverLocalSession } from "@/lib/local-beta-context";

/** Null when this account is not on the beta clock, or the table is not migrated yet. */
export async function betaDeletionLabel(userId: string) {
  if (await serverLocalSession()) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("account_retention")
      .select("expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data?.expires_at) return null;
    const when = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    }).format(new Date(data.expires_at));
    return `This beta account and everything in it, including uploads, is deleted on ${when}.`;
  } catch {
    return null;
  }
}

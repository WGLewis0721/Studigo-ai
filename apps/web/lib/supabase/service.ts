import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for ingestion, grading and cleanup writes. It bypasses RLS, so every
 * caller must have already established which user owns the row it touches, and
 * it must never be constructed in code that reaches the browser.
 */
export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

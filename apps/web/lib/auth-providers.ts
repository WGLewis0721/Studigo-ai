/**
 * Which social providers Supabase Auth has switched on for this project.
 *
 * The login and signup pages only show "Continue with Google" when Google is
 * actually enabled, so a provider that has not been configured yet (or was
 * switched off) never appears as a button that fails with
 * "provider is not enabled". It shows up on its own the moment it is enabled in
 * the Supabase dashboard (Authentication → Sign In / Providers), within the
 * cache window below, with no redeploy.
 *
 * `/auth/v1/settings` is public and only needs the publishable key already
 * shipped to the browser.
 */
const CACHE_SECONDS = 300;
const TIMEOUT_MS = 3000;

export async function googleSignInEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS }
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    // Unknown means hidden: email sign-in still works, and a dead button does not.
    return false;
  }
}

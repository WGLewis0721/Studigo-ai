/**
 * Studigo has no guest mode. Supabase anonymous sessions (left over from an
 * earlier testing bypass, or minted directly with the public anon key while
 * anonymous sign-ins are enabled on the Auth project) are treated as signed out
 * so they cannot reach paid AI, ingestion or storage paths.
 */
export function isSignedInAccount(user: { is_anonymous?: boolean | null } | null | undefined): boolean {
  return Boolean(user) && user!.is_anonymous !== true;
}

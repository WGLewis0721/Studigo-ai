import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function drainStorageCleanup(ownerId?: string) {
  const service = createServiceSupabaseClient();
  let query = service.from("storage_cleanup_jobs").select("id, storage_path, attempts").lte("created_at", new Date(Date.now() - 10 * 60_000).toISOString()).order("created_at").limit(100);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data: jobs, error } = await query;
  if (error) throw new Error(error.message);
  let pending = 0;
  for (const job of jobs ?? []) {
    const { error: removalError } = await service.storage.from("study-materials").remove([job.storage_path]);
    if (removalError) {
      pending++;
      const { error: updateError } = await service.from("storage_cleanup_jobs").update({ attempts: job.attempts + 1, last_error: removalError.message }).eq("id", job.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: deleteError } = await service.from("storage_cleanup_jobs").delete().eq("id", job.id);
      if (deleteError) throw new Error(deleteError.message);
    }
  }
  return { pending };
}

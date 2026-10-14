import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";
import { guardAiRequestWith, type AdmissionWriter } from "./ai-admission-core";
import type { AiOperation } from "./ai-admission-policy";

/**
 * Public admission entry point for AI routes. All behavior lives in ai-admission-core so it
 * can be tested without Next or Supabase; this wrapper only supplies the real dependencies.
 */
export async function guardAiRequest(
  request: Request,
  operation: AiOperation,
  handle: (request: Request) => Promise<Response>
): Promise<Response> {
  return guardAiRequestWith({
    env: process.env,
    requireUser: requireApiUser,
    createWriter: () => createServiceSupabaseClient() as unknown as AdmissionWriter
  }, request, operation, handle);
}

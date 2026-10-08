import { randomUUID } from "node:crypto";
import { protectAiStream } from "./ai-stream-lease";
import { withProviderWorkBudget } from "@studigo/ai";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";
import {
  admissionLimits, estimatedReservation, hashedIp, requestKey, trustedClientIp,
  type AiOperation
} from "./ai-admission-policy";

type AdmissionReply = { allowed: boolean; reason?: string; lease_id?: string };

function denial(reason: string): Response {
  const unavailable = reason === "unavailable" || reason === "invalid";
  const status = unavailable ? 503 : 429;
  const message = unavailable
    ? "Studigo is temporarily unable to start this AI operation. Try again shortly."
    : reason === "duplicate"
      ? "This operation is already being handled. Wait for the result before retrying."
      : "Studigo has reached a temporary study-resource limit. Try again shortly.";
  return Response.json({ error: message, code: reason }, {
    status, headers: { "Retry-After": unavailable ? "60" : "60", "Cache-Control": "no-store" }
  });
}

type AiWriter = ReturnType<typeof createServiceSupabaseClient>;

async function complete(writer: AiWriter, id: string) {
  try {
    const { error } = await writer.rpc("finish_studigo_ai_resource", { p_lease_id: id });
    if (error) throw error;
  } catch {
    // The lease expires after six minutes. Do not expose provider or SQL details to learners.
    console.error("Studigo AI admission lease completion failed");
  }
}

/**
 * Disabled by default so an unapplied migration cannot disrupt the golden beta.
 * When enabled, absence of policy, IP provenance, or Postgres is fail-closed.
 * Admission reservations are estimates and do not establish provider spend ceilings.
 */
export async function guardAiRequest(
  request: Request,
  operation: AiOperation,
  handle: (request: Request) => Promise<Response>
): Promise<Response> {
  if (process.env.STUDIGO_AI_ADMISSION !== "1") return handle(request);

  const { user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized!;

  let writer: AiWriter;
  let leaseId: string;
  try {
    const limits = admissionLimits(process.env);
    const ip = trustedClientIp(
      request.headers, process.env.VERCEL === "1", process.env.NODE_ENV !== "production"
    );
    if (!ip) return denial("unavailable");
    const ipHash = hashedIp(ip, process.env.STUDIGO_AI_IP_HASH_SECRET ?? "");
    writer = createServiceSupabaseClient();
    leaseId = randomUUID();
    const { data, error } = await writer.rpc("admit_studigo_ai_resource", {
      p_lease_id: leaseId,
      p_owner_id: user.id,
      p_ip_hash: ipHash,
      p_operation: operation,
      p_request_key: requestKey(request.headers.get("x-studigo-operation-id")),
      p_reserved_micro_usd: estimatedReservation(operation),
      p_user_minute: limits.userMinute,
      p_ip_minute: limits.ipMinute,
      p_global_minute: limits.globalMinute,
      p_user_concurrent: limits.userConcurrent,
      p_ip_concurrent: limits.ipConcurrent,
      p_global_concurrent: limits.globalConcurrent,
      p_user_daily_micro_usd: limits.userDailyMicroUsd,
      p_global_daily_micro_usd: limits.globalDailyMicroUsd
    });
    if (error) return denial("unavailable");
    const reply = data as AdmissionReply | null;
    if (!reply?.allowed) return denial(reply?.reason ?? "unavailable");
  } catch {
    console.error("Studigo AI admission failed closed");
    return denial("unavailable");
  }

  const settle = () => complete(writer, leaseId);
  return withProviderWorkBudget(operation, request.signal, async () => {
    try {
      const response = await handle(request);
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        return protectAiStream(response, settle, request.signal);
      }
      await settle();
      return response;
    } catch (error) {
      await settle();
      throw error;
    }
  });
}

import { createHash, randomUUID } from "node:crypto";
import { protectAiStream } from "./ai-stream-lease";
import { abortAndDrainProviderWork, withProviderWorkBudget } from "@studigo/ai";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";
import {
  admissionLimits, estimatedReservation, hashedIp, requestKey, trustedClientIp,
  type AiOperation
} from "./ai-admission-policy";

type AdmissionReply = { allowed: boolean; reason?: string; lease_id?: string };
type ReceiptReply = { claimed: boolean; reason?: string };

function denial(reason: string): Response {
  const unavailable = reason === "unavailable" || reason === "invalid";
  const status = unavailable ? 503 : reason === "idempotency_conflict" ? 409 : reason === "completed" ? 202 : 429;
  const message = unavailable
    ? "Studigo is temporarily unable to start this AI operation. Try again shortly."
    : reason === "idempotency_conflict"
      ? "That operation ID was already used for different request data."
      : reason === "completed"
        ? "This operation already completed. Reload its Study Room result instead of running it again."
    : reason === "duplicate" || reason === "running" || reason === "ambiguous"
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
    // The lease has a ten-minute recovery horizon. Do not expose provider or SQL details to learners.
    console.error("Studigo AI admission lease completion failed");
  }
}

async function requestFingerprint(request: Request): Promise<string> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 64 * 1024 * 1024) throw new Error("request too large");
  const body = Buffer.from(await request.clone().arrayBuffer());
  if (body.byteLength > 64 * 1024 * 1024) throw new Error("request too large");
  return createHash("sha256")
    .update(request.method).update("\0").update(new URL(request.url).pathname).update("\0").update(body)
    .digest("hex");
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
  let operationKey: string;
  let ownerId: string;
  let receiptClaimed = false;
  try {
    const limits = admissionLimits(process.env);
    const ip = trustedClientIp(
      request.headers, process.env.VERCEL === "1", process.env.NODE_ENV !== "production"
    );
    if (!ip) return denial("unavailable");
    const ipHash = hashedIp(ip, process.env.STUDIGO_AI_IP_HASH_SECRET ?? "");
    writer = createServiceSupabaseClient();
    ownerId = user.id;
    operationKey = requestKey(request.headers.get("x-studigo-operation-id"));
    const fingerprint = await requestFingerprint(request);
    const receipt = await writer.rpc("claim_studigo_ai_receipt", {
      p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey,
      p_request_fingerprint: fingerprint
    });
    if (receipt.error) return denial("unavailable");
    const receiptReply = receipt.data as ReceiptReply | null;
    if (!receiptReply?.claimed) return denial(receiptReply?.reason ?? "unavailable");
    receiptClaimed = true;
    leaseId = randomUUID();
    const { data, error } = await writer.rpc("admit_studigo_ai_resource", {
      p_lease_id: leaseId,
      p_owner_id: ownerId,
      p_ip_hash: ipHash,
      p_operation: operation,
      p_request_key: operationKey,
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
    if (error) {
      await writer.rpc("finish_studigo_ai_receipt", { p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey, p_completed: false });
      return denial("unavailable");
    }
    const reply = data as AdmissionReply | null;
    if (!reply?.allowed) {
      await writer.rpc("finish_studigo_ai_receipt", { p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey, p_completed: false });
      return denial(reply?.reason ?? "unavailable");
    }
    const started = await writer.rpc("start_studigo_ai_receipt", {
      p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey
    });
    if (started.error || started.data !== true) {
      await complete(writer, leaseId);
      return denial("unavailable");
    }
  } catch {
    if (receiptClaimed && writer! && ownerId! && operationKey!) {
      await writer.rpc("finish_studigo_ai_receipt", { p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey, p_completed: false }).catch(() => undefined);
    }
    console.error("Studigo AI admission failed closed");
    return denial("unavailable");
  }

  let renewal: ReturnType<typeof setInterval> | undefined;
  const stopRenewal = () => { if (renewal) clearInterval(renewal); renewal = undefined; };
  const settle = async () => {
    stopRenewal();
    await abortAndDrainProviderWork();
    await complete(writer, leaseId);
    const receipt = await writer.rpc("finish_studigo_ai_receipt", {
      p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey, p_completed: true
    });
    if (receipt.error) console.error("Studigo AI receipt completion failed");
  };
  return withProviderWorkBudget(operation, request.signal, async () => {
    renewal = setInterval(() => {
      void writer.rpc("renew_studigo_ai_resource", { p_lease_id: leaseId }).then(({ data, error }) => {
        if (error || data !== true) void abortAndDrainProviderWork();
      });
    }, 60_000);
    renewal.unref?.();
    try {
      const response = await handle(request);
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        return protectAiStream(response, settle, request.signal);
      }
      await settle();
      return response;
    } catch (error) {
      stopRenewal();
      await abortAndDrainProviderWork();
      await complete(writer, leaseId);
      await writer.rpc("finish_studigo_ai_receipt", {
        p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey, p_completed: false
      }).catch(() => undefined);
      throw error;
    }
  });
}



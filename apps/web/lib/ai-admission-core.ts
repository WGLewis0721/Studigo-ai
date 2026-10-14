import { createHash, randomUUID } from "node:crypto";
import { abortAndDrainProviderWork, withProviderWorkBudget } from "@studigo/ai";
import { protectAiStream } from "./ai-stream-lease";
import {
  admissionLimits, estimatedReservation, hashedIp, ipLimitKey, isValidOperationId,
  requestKey, trustedClientIp, type AiOperation
} from "./ai-admission-policy";

type AdmissionReply = { allowed: boolean; reason?: string; lease_id?: string };
type ReceiptReply = { claimed: boolean; reason?: string };

export type RpcResult = { data: unknown; error: unknown };
/** The only database surface admission needs. The Supabase service client satisfies it. */
export type AdmissionWriter = { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult> };
export type AdmissionDeps = {
  env: Record<string, string | undefined>;
  requireUser: () => Promise<{ user: { id: string } | null; unauthorized?: Response | null }>;
  createWriter: () => AdmissionWriter;
  /** How long to wait for aborted provider work to settle before leaving the lease to expire. */
  drainTimeoutMs?: number;
};

const DRAIN_TIMEOUT_MS = 90_000;
const RENEW_EVERY_MS = 60_000;
const MAX_FINGERPRINT_BODY = 64 * 1024 * 1024;

const MESSAGES: Record<string, [number, string]> = {
  unavailable: [503, "Studigo is temporarily unable to start this AI operation. Try again shortly."],
  invalid: [503, "Studigo is temporarily unable to start this AI operation. Try again shortly."],
  invalid_operation_id: [400, "The operation ID must be a UUID."],
  idempotency_conflict: [409, "That operation ID was already used for different request data."],
  ambiguous: [409, "That operation may already have run. Start a new request instead of retrying this one."],
  completed: [202, "This operation already completed. Reload its Study Room result instead of running it again."],
  duplicate: [429, "This operation is already being handled. Wait for the result before retrying."],
  running: [429, "This operation is already being handled. Wait for the result before retrying."],
  user_budget: [429, "Today’s study-resource allowance is used up. Try again tomorrow."],
  global_budget: [429, "Today’s shared study-resource allowance is used up. Try again tomorrow."],
  rate: [429, "Too many study requests in one minute. Please try again shortly."],
  concurrent: [429, "Studigo is already working on another study request. Wait for it to finish."],
  busy: [429, "Studigo is busy starting another request. Try again shortly."]
};

export function denial(reason: string): Response {
  const [status, message] = MESSAGES[reason]
    ?? [429, "Studigo has reached a temporary study-resource limit. Try again shortly."];
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 429 || status === 503) headers["Retry-After"] = "60";
  return Response.json({ error: message, code: reason }, { status, headers });
}

async function complete(writer: AdmissionWriter, id: string) {
  try {
    const { error } = await writer.rpc("finish_studigo_ai_resource", { p_lease_id: id });
    if (error) throw error;
  } catch {
    // The lease has a ten-minute recovery horizon. Do not expose provider or SQL details to learners.
    console.error("Studigo AI admission lease completion failed");
  }
}

/** Never throws: receipt bookkeeping must not mask a result or the original error. */
async function finishReceipt(
  writer: AdmissionWriter, ownerId: string, operation: string, key: string, completed: boolean
) {
  try {
    const { error } = await writer.rpc("finish_studigo_ai_receipt", {
      p_owner_id: ownerId, p_operation: operation, p_request_key: key, p_completed: completed
    });
    if (error) console.error("Studigo AI receipt update failed");
  } catch {
    console.error("Studigo AI receipt update failed");
  }
}

async function requestFingerprint(request: Request): Promise<string> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_FINGERPRINT_BODY) throw new Error("request too large");
  const body = Buffer.from(await request.clone().arrayBuffer());
  if (body.byteLength > MAX_FINGERPRINT_BODY) throw new Error("request too large");
  return createHash("sha256")
    .update(request.method).update("\0").update(new URL(request.url).pathname).update("\0").update(body)
    .digest("hex");
}

/**
 * Disabled by default so an unapplied migration cannot disrupt the golden beta.
 * When enabled, absence of policy, IP provenance, or Postgres is fail-closed.
 * Admission reservations are estimates and do not establish provider spend ceilings.
 */
export async function guardAiRequestWith(
  deps: AdmissionDeps,
  request: Request,
  operation: AiOperation,
  handle: (request: Request) => Promise<Response>
): Promise<Response> {
  const env = deps.env;
  if (env.STUDIGO_AI_ADMISSION !== "1") return handle(request);

  const { user, unauthorized } = await deps.requireUser();
  if (!user) return unauthorized ?? new Response(null, { status: 401 });

  // A supplied-but-malformed ID must not silently become a fresh one: the caller would
  // believe a retry is replay-safe when every attempt would actually run.
  const supplied = request.headers.get("x-studigo-operation-id");
  if (supplied !== null && !isValidOperationId(supplied)) return denial("invalid_operation_id");

  let writer: AdmissionWriter | undefined;
  let leaseId = "";
  let operationKey = "";
  const ownerId = user.id;
  let receiptClaimed = false;
  try {
    const limits = admissionLimits(env);
    const ip = trustedClientIp(request.headers, env.VERCEL === "1", env.NODE_ENV !== "production");
    if (!ip) return denial("unavailable");
    const ipHash = hashedIp(ipLimitKey(ip), env.STUDIGO_AI_IP_HASH_SECRET ?? "");
    writer = deps.createWriter();
    operationKey = requestKey(supplied);
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
      await finishReceipt(writer, ownerId, operation, operationKey, false);
      return denial("unavailable");
    }
    const reply = data as AdmissionReply | null;
    if (!reply?.allowed) {
      await finishReceipt(writer, ownerId, operation, operationKey, false);
      return denial(reply?.reason ?? "unavailable");
    }
    const started = await writer.rpc("start_studigo_ai_receipt", {
      p_owner_id: ownerId, p_operation: operation, p_request_key: operationKey
    });
    if (started.error || started.data !== true) {
      await complete(writer, leaseId);
      await finishReceipt(writer, ownerId, operation, operationKey, false);
      return denial("unavailable");
    }
  } catch {
    if (receiptClaimed && writer) await finishReceipt(writer, ownerId, operation, operationKey, false);
    console.error("Studigo AI admission failed closed");
    return denial("unavailable");
  }

  const guard = writer;
  const drainTimeoutMs = deps.drainTimeoutMs ?? DRAIN_TIMEOUT_MS;
  let renewal: ReturnType<typeof setInterval> | undefined;
  const stopRenewal = () => { if (renewal) clearInterval(renewal); renewal = undefined; };

  /** True when every registered provider request actually settled. */
  async function drainProviderWork(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const gaveUp = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), drainTimeoutMs); });
    try {
      return await Promise.race([abortAndDrainProviderWork().then(() => true as const), gaveUp]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  let settling: Promise<void> | undefined;
  /**
   * Ends the operation exactly once. The lease keeps renewing WHILE aborted provider work
   * drains, and is released only after that work has actually stopped. If it never stops
   * the lease is left to expire (conservative non-release) and the receipt is ambiguous.
   * `completed` is true only for a successful outcome: a cancelled stream or an error
   * response must never be recorded as a replayable completed result.
   */
  const settle = (completed = true): Promise<void> => (settling ??= (async () => {
    const drained = await drainProviderWork();
    stopRenewal();
    if (drained) await complete(guard!, leaseId);
    else console.error("Studigo AI provider work did not stop; lease left to expire");
    await finishReceipt(guard!, ownerId, operation, operationKey, completed && drained);
  })());

  return withProviderWorkBudget(operation, request.signal, async () => {
    renewal = setInterval(() => {
      void Promise.resolve(guard!.rpc("renew_studigo_ai_resource", { p_lease_id: leaseId })).then(
        ({ data, error }) => { if (error || data !== true) void abortAndDrainProviderWork(); },
        () => { void abortAndDrainProviderWork(); }
      );
    }, RENEW_EVERY_MS);
    renewal.unref?.();
    try {
      const response = await handle(request);
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        return protectAiStream(response, settle, request.signal);
      }
      await settle(response.ok);
      return response;
    } catch (error) {
      await settle(false);
      throw error;
    }
  });
}

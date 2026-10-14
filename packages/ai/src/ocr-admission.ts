import { chatModel, responseOptions } from "./client";
import { debitResponseWork, providerAbortSignal, trackProviderCall } from "./provider-budget";

/**
 * C07 OCR admission contract (PR #99). GPT integrates this boundary in #107/#110.
 * This module does not select pages, change prompts, or interpret transcripts.
 *
 * `requestOcr` must not call `client().responses.create` itself. Send the already
 * built Responses body through `executeAdmittedOcrRequest`:
 *
 * 1. Document OCR runs only inside `guardAiRequest` for `document-process` or
 *    `document-reindex`. That guard already opened `withProviderWorkBudget`.
 *    Do not admit a second lease per page.
 * 2. This function debits the page (including file bytes) before the SDK call.
 *    The document envelope is 64 response calls, 80_000_000 metered bytes, and
 *    180 seconds. `MAX_OCR_PAGES` is 40, leaving room for one topic-map call.
 * 3. `start` receives one signal: admission budget + caller abort + per-page
 *    timeout. Do not replace it with `AbortSignal.timeout` alone.
 * 4. `trackProviderCall` keeps the page request in the in-flight set so the
 *    route cannot release its lease while that promise is unsettled. Pass
 *    `maxRetries: 0`. The shared client already forces that when
 *    `STUDIGO_AI_ADMISSION=1`.
 * 5. With admission enabled, a call outside `withProviderWorkBudget` throws
 *    before `start` and must not reach the provider.
 */
export async function executeAdmittedOcrRequest<T>(args: {
  model: string;
  maxOutputTokens: number | undefined;
  /** Counted against the response-byte envelope. Include the page bytes. */
  meteredInput: unknown;
  requestSignal?: AbortSignal;
  /** Per-page cap. Composed with admission cancellation; never replaces it. */
  timeoutMs?: number;
  start: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const timeoutMs = args.timeoutMs ?? 60_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 180_000) {
    throw new Error("OCR timeout is outside the admission envelope");
  }
  debitResponseWork({
    model: args.model,
    input: args.meteredInput,
    max_output_tokens: args.maxOutputTokens
  });
  const timeout = AbortSignal.timeout(timeoutMs);
  const parent = providerAbortSignal(args.requestSignal);
  const signal = parent ? AbortSignal.any([parent, timeout]) : timeout;
  return trackProviderCall(() => args.start(signal));
}

/** Metering fields for the current chat transport. Page selection stays with the caller. */
export function ocrAdmissionMeter(input: unknown): {
  model: string;
  maxOutputTokens: number | undefined;
  meteredInput: unknown;
} {
  const options = responseOptions();
  return { model: chatModel(), maxOutputTokens: options.max_output_tokens, meteredInput: input };
}

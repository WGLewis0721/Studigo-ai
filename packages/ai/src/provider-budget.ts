import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Hard, per-request provider work envelopes. Every supported model call in
 * @studigo/ai must debit this scope BEFORE sending a provider request.
 * This is a work cap, NOT a dollar invoice or a replacement for provider caps.
 */
type WorkState = {
  signal: AbortSignal;
  controller: AbortController;
  inFlight: Set<Promise<unknown>>;
  deadline: number;
  responseCalls: number;
  embeddingCalls: number;
  responseBytes: number;
  embeddingChars: number;
  maxResponseCalls: number;
  maxEmbeddingCalls: number;
  maxResponseBytes: number;
  maxEmbeddingChars: number;
};
const store = new AsyncLocalStorage<WorkState>();
const DOC_OPERATIONS = new Set(["document-upload", "document-process", "document-reindex"]);

export function withProviderWorkBudget<T>(
  operation: string, requestSignal: AbortSignal, run: () => Promise<T>
): Promise<T> {
  const doc = DOC_OPERATIONS.has(operation);
  // The whole operation times out well before the ten-minute SQL recovery horizon.
  const deadline = Date.now() + 180_000;
  const controller = new AbortController();
  const signal = AbortSignal.any([requestSignal, controller.signal, AbortSignal.timeout(180_000)]);
  const state: WorkState = {
    signal, controller, inFlight: new Set(), deadline, responseCalls: 0, embeddingCalls: 0,
    responseBytes: 0, embeddingChars: 0,
    maxResponseCalls: doc ? 64 : 16,
    maxEmbeddingCalls: doc ? 128 : 32,
    maxResponseBytes: doc ? 80_000_000 : 4_000_000,
    maxEmbeddingChars: doc ? 12_000_000 : 500_000
  };
  return store.run(state, run);
}

function active(): WorkState | undefined {
  const current = store.getStore();
  if (!current && process.env.STUDIGO_AI_ADMISSION === "1") {
    throw new Error("Provider work attempted outside an admission scope");
  }
  if (current && (current.signal.aborted || Date.now() >= current.deadline)) {
    throw new Error("AI work deadline exceeded");
  }
  return current;
}

/** Register the real SDK request promise so admission can drain it before release. */
export function trackProviderCall<T>(start: () => Promise<T>): Promise<T> {
  const scope = active();
  const work = start();
  if (!scope) return work;
  const tracked = work.finally(() => { scope.inFlight.delete(tracked); });
  scope.inFlight.add(tracked);
  return tracked;
}

/**
 * End a non-streaming operation safely: cancel cooperative SDK calls and retain
 * the admission lease until every registered request has actually settled.
 */
export async function abortAndDrainProviderWork(): Promise<void> {
  const scope = store.getStore();
  if (!scope) return;
  if (!scope.controller.signal.aborted) scope.controller.abort("operation finished");
  while (scope.inFlight.size) {
    await Promise.allSettled([...scope.inFlight]);
  }
}

/** Works even with a cancelled HTTP response because async-start inherits the scope. */
export function providerAbortSignal(requestSignal?: AbortSignal): AbortSignal | undefined {
  const budgetSignal = store.getStore()?.signal;
  if (requestSignal && budgetSignal) return AbortSignal.any([requestSignal, budgetSignal]);
  return requestSignal ?? budgetSignal;
}

const CHAT_MODELS = new Set(["gpt-4.1-mini", "openai/gpt-4.1-mini"]);
const EMBEDDING_MODELS = new Set(["text-embedding-3-small", "openai/text-embedding-3-small"]);

export function debitResponseWork(params: {
  model: string; input?: unknown; max_output_tokens?: number;
}): void {
  const scope = active();
  if (!scope) return;
  if (!CHAT_MODELS.has(params.model)) throw new Error("This provider model has no approved work budget");
  const output = params.max_output_tokens;
  if (!Number.isSafeInteger(output) || (output ?? 0) < 1 || (output ?? 0) > 4096) {
    throw new Error("Model output budget is missing or exceeds the hard cap");
  }
  const bytes = Buffer.byteLength(JSON.stringify(params.input ?? ""));
  if (bytes > 4_000_000 ||
      scope.responseCalls + 1 > scope.maxResponseCalls ||
      scope.responseBytes + bytes > scope.maxResponseBytes) {
    throw new Error("AI response work allowance exhausted");
  }
  scope.responseCalls += 1;
  scope.responseBytes += bytes;
}

export function debitEmbeddingWork(model: string, inputs: string[]): void {
  const scope = active();
  if (!scope) return;
  if (!EMBEDDING_MODELS.has(model)) throw new Error("This embedding model has no approved work budget");
  const chars = inputs.reduce((sum, value) => sum + value.length, 0);
  if (inputs.length > 96 || chars > 96 * 24_000 ||
      scope.embeddingCalls + 1 > scope.maxEmbeddingCalls ||
      scope.embeddingChars + chars > scope.maxEmbeddingChars) {
    throw new Error("AI embedding work allowance exhausted");
  }
  scope.embeddingCalls += 1;
  scope.embeddingChars += chars;
}



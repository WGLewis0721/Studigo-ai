import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Hard, per-request provider work envelopes. Every supported model call in
 * @studigo/ai must debit this scope BEFORE sending a provider request.
 * This is a work cap, NOT a dollar invoice or a replacement for provider caps.
 */
type WorkState = {
  signal: AbortSignal;
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
  // The whole operation times out before the six-minute SQL lease expires.
  const deadline = Date.now() + 180_000;
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(180_000)]);
  const state: WorkState = {
    signal, deadline, responseCalls: 0, embeddingCalls: 0,
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
  if (current && (current.signal.aborted || Date.now() >= current.deadline)) {
    throw new Error("AI work deadline exceeded");
  }
  return current;
}

/** Works even with a cancelled HTTP response because async-start inherits the scope. */
export function providerAbortSignal(): AbortSignal | undefined {
  return store.getStore()?.signal;
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

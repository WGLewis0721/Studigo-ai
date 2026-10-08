/**
 * Cancelling a Response reader does not necessarily cancel an async
 * ReadableStream.start producer. Do not release an AI concurrency lease
 * until the registered producer has actually terminated.
 */
const producers = new WeakMap<Response, Promise<unknown>>();
export function trackAiStreamProducer(response: Response, producerDone: Promise<unknown>): Response {
  producers.set(response, producerDone);
  return response;
}

export function protectAiStream(
  response: Response, settle: () => Promise<void>, requestSignal?: AbortSignal
): Response {
  const reader = response.body?.getReader();
  if (!reader) return response;
  const producerDone = producers.get(response);
  let settled = false;
  const once = async () => {
    if (settled) return;
    settled = true;
    requestSignal?.removeEventListener("abort", onAbort);
    if (producerDone) {
      try { await producerDone; } catch { /* still count until termination */ }
    }
    await settle();
  };
  const onAbort = () => {
    // Abort of the incoming request is not proof the upstream provider stopped.
    void reader.cancel().catch(() => {}).finally(() => { void once(); });
  };
  requestSignal?.addEventListener("abort", onAbort, { once: true });
  if (requestSignal?.aborted) onAbort();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          await once();
          controller.close();
        } else controller.enqueue(next.value);
      } catch (error) {
        await once();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } finally { await once(); }
    }
  });
  return new Response(stream, {
    status: response.status, statusText: response.statusText, headers: response.headers
  });
}

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

/**
 * `settle(completed)` receives true only when the stream finished on its own. A cancelled
 * reader, an aborted request or a read error ends the work but must not be recorded as a
 * replayable completed result.
 */
export function protectAiStream(
  response: Response, settle: (completed?: boolean) => Promise<void>, requestSignal?: AbortSignal
): Response {
  const reader = response.body?.getReader();
  if (!reader) return response;
  const producerDone = producers.get(response);
  let settled = false;
  const once = async (completed: boolean) => {
    if (settled) return;
    settled = true;
    requestSignal?.removeEventListener("abort", onAbort);
    if (producerDone) {
      try { await producerDone; } catch { /* still count until termination */ }
    }
    await settle(completed);
  };
  const onAbort = () => {
    // Abort of the incoming request is not proof the upstream provider stopped.
    // Claim the outcome first: cancelling the reader makes a pending read resolve as done,
    // which would otherwise be misrecorded as a natural completion.
    const finished = once(false);
    void reader.cancel().catch(() => {}).finally(() => { void finished; });
  };
  requestSignal?.addEventListener("abort", onAbort, { once: true });
  if (requestSignal?.aborted) onAbort();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          await once(true);
          controller.close();
        } else controller.enqueue(next.value);
      } catch (error) {
        await once(false);
        controller.error(error);
      }
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } finally { await once(false); }
    }
  });
  return new Response(stream, {
    status: response.status, statusText: response.statusText, headers: response.headers
  });
}

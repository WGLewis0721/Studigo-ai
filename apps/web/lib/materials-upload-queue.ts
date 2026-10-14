/** One upload admission queue shared by every file selection in a mounted panel. */
export function createBoundedUploadQueue(maxConcurrent: number) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error("Upload concurrency must be a positive integer.");
  }

  const pending: Array<() => Promise<void>> = [];
  let active = 0;

  function drain() {
    while (active < maxConcurrent && pending.length > 0) {
      const upload = pending.shift()!;
      active += 1;
      void Promise.resolve()
        .then(upload)
        .catch(() => {
          // Each upload owns its visible error state; a failure cannot stall later files.
        })
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  }

  return {
    enqueue(upload: () => Promise<void>) {
      pending.push(upload);
      drain();
    }
  };
}

/** Capture one batch's source type when selected, including jobs waiting for a slot. */
export function enqueueUploadBatch<File, SourceType>(
  queue: ReturnType<typeof createBoundedUploadQueue>,
  files: readonly File[],
  sourceType: SourceType,
  upload: (file: File, sourceType: SourceType) => Promise<void>
) {
  for (const file of files) queue.enqueue(() => upload(file, sourceType));
}

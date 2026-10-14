export type IntakeStage = "uploading" | "processing" | "done" | "error";

export type IntakeFile = { key: string; name: string };

/**
 * Uploads start together. Processing stays one-at-a-time so a slow file does
 * not block the next upload, and one failure does not cancel the rest.
 */
export async function runMaterialIntake<T extends IntakeFile>(args: {
  files: T[];
  sourceType: string;
  upload: (file: T, sourceType: string) => Promise<{ id: string }>;
  processOne: (id: string) => Promise<void>;
  onStage: (file: T, stage: IntakeStage, message?: string) => void;
  active?: () => boolean;
}): Promise<void> {
  const snapshot = args.sourceType;
  const started = new Set<string>();
  let tail = Promise.resolve();
  const enqueue = (task: () => Promise<void>) => {
    tail = tail.then(task, task);
  };

  await Promise.all(args.files.map(async (file) => {
    if (args.active && !args.active()) return;
    args.onStage(file, "uploading");
    try {
      const uploaded = await args.upload(file, snapshot);
      if (!uploaded.id || started.has(uploaded.id)) return;
      started.add(uploaded.id);
      enqueue(async () => {
        if (args.active && !args.active()) return;
        args.onStage(file, "processing");
        try {
          await args.processOne(uploaded.id);
          if (!args.active || args.active()) args.onStage(file, "done");
        } catch (error) {
          if (!args.active || args.active()) {
            args.onStage(file, "error", error instanceof Error ? error.message : "Processing failed");
          }
        }
      });
    } catch (error) {
      if (!args.active || args.active()) {
        args.onStage(file, "error", error instanceof Error ? error.message : "Upload failed");
      }
    }
  }));
  await tail;
}

/** A repeated Retry for the same document waits on the attempt already running. */
export function createProcessGate() {
  const running = new Map<string, Promise<unknown>>();
  return async function once(id: string, work: () => Promise<unknown>) {
    const current = running.get(id);
    if (current) return current;
    const attempt = work().finally(() => {
      if (running.get(id) === attempt) running.delete(id);
    });
    running.set(id, attempt);
    return attempt;
  };
}

/** Closing discards the unapplied draft by restoring the applied value. */
export function closeTeachingStyle<T>(applied: T): { open: false; draft: T } {
  return { open: false, draft: applied };
}

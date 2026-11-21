import assert from "node:assert/strict";
import { test } from "node:test";
import { LAST_SEEN_KEY, RETURN_AFTER_MS, isReturn, readLastSeen, writeLastSeen } from "./companion-session";

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

function withStorage(storage: Partial<Storage> | null, body: () => void) {
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = storage === null ? undefined : { localStorage: storage };
  try {
    body();
  } finally {
    (globalThis as { window?: unknown }).window = original;
  }
}

test("the return window is thirty minutes", () => {
  assert.equal(RETURN_AFTER_MS, 30 * MINUTE);
});

test("a first visit with nothing saved is never a return", () => {
  assert.equal(isReturn(null, NOW), false);
});

test("a break under thirty minutes is the same sitting", () => {
  assert.equal(isReturn(NOW - MINUTE, NOW), false);
  assert.equal(isReturn(NOW - RETURN_AFTER_MS + 1, NOW), false);
});

test("thirty minutes or more is a return, and the length of the gap does not matter", () => {
  assert.equal(isReturn(NOW - RETURN_AFTER_MS, NOW), true);
  assert.equal(isReturn(NOW - 2 * 60 * MINUTE, NOW), true);
  assert.equal(isReturn(NOW - 3 * 24 * 60 * MINUTE, NOW), true);
});

test("a saved time ahead of the clock (the clock moved back) is not a return", () => {
  assert.equal(isReturn(NOW + 45 * MINUTE, NOW), false);
});

test("the saved time is read back, and missing or unreadable values read as never seen", () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); }
  };
  withStorage(storage, () => {
    assert.equal(readLastSeen(), null);
    writeLastSeen(NOW);
    assert.equal(saved.get(LAST_SEEN_KEY), String(NOW));
    assert.equal(readLastSeen(), NOW);
    saved.set(LAST_SEEN_KEY, "");
    assert.equal(readLastSeen(), null, "an empty value is not a time");
    saved.set(LAST_SEEN_KEY, "{bad");
    assert.equal(readLastSeen(), null, "a malformed value is not a time");
    saved.set(LAST_SEEN_KEY, "-5");
    assert.equal(readLastSeen(), null, "a negative value is not a time");
  });
});

test("blocked storage reads as never seen and a failed write is silent", () => {
  const blocked = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); }
  };
  withStorage(blocked, () => {
    assert.equal(readLastSeen(), null);
    assert.doesNotThrow(() => writeLastSeen(NOW));
  });
  withStorage(null, () => {
    assert.equal(readLastSeen(), null);
    assert.doesNotThrow(() => writeLastSeen(NOW));
  });
});

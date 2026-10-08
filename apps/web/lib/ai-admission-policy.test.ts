import assert from "node:assert/strict";
import test from "node:test";
import {
  admissionLimits, estimatedReservation, hashedIp, requestKey, trustedClientIp
} from "./ai-admission-policy";

const good = {
  STUDIGO_AI_USER_PER_MINUTE: "8", STUDIGO_AI_IP_PER_MINUTE: "30",
  STUDIGO_AI_GLOBAL_PER_MINUTE: "120", STUDIGO_AI_USER_CONCURRENT: "2",
  STUDIGO_AI_IP_CONCURRENT: "8", STUDIGO_AI_GLOBAL_CONCURRENT: "20",
  STUDIGO_AI_USER_DAILY_MICRO_USD: "2000000",
  STUDIGO_AI_GLOBAL_DAILY_MICRO_USD: "20000000"
};

test("admission must have all eight explicit positive limits", () => {
  assert.equal(admissionLimits(good).userConcurrent, 2);
  for (const key of Object.keys(good)) {
    assert.throws(() => admissionLimits({ ...good, [key]: undefined }), /Missing or invalid/);
    assert.throws(() => admissionLimits({ ...good, [key]: "0" }), /Missing or invalid/);
    assert.throws(() => admissionLimits({ ...good, [key]: "infinity" }), /Missing or invalid/);
  }
});

test("production never trusts caller-supplied forwarding headers outside Vercel", () => {
  const h = new Headers({ "x-forwarded-for": "203.0.113.1", "x-real-ip": "203.0.113.2" });
  assert.equal(trustedClientIp(h, false, false), null);
  assert.equal(trustedClientIp(h, false, true), "127.0.0.1");
  assert.equal(trustedClientIp(h, true, false), "203.0.113.1");
  assert.equal(trustedClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 8.8.8.8" }), true, false), null);
  assert.equal(trustedClientIp(new Headers({ "x-forwarded-for": "not-an-ip" }), true, false), null);
});

test("IP addresses are irreversibly keyed by server-only HMAC and not logged raw", () => {
  const secret = "a-long-secret-used-only-in-tests-32-bytes";
  const first = hashedIp("203.0.113.1", secret);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, hashedIp("203.0.113.1", secret));
  assert.notEqual(first, hashedIp("203.0.113.2", secret));
  assert.throws(() => hashedIp("203.0.113.1", "weak"));
});

test("all supported expensive operations reserve positive work estimates", () => {
  for (const type of [
    "chat","learn","learn-check","quiz-generate","quiz-grade","flashcards-generate",
    "practice-test-generate","practice-test-grade","document-process","document-reindex","topic-regenerate"
  ] as const) assert.ok(estimatedReservation(type) > 0);
});

test("request keys only reuse recognized UUIDs, otherwise generate unique IDs", () => {
  const valid = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(requestKey(valid), valid);
  assert.match(requestKey("not-a-uuid"), /^[a-f0-9-]{36}$/);
  assert.notEqual(requestKey(null), requestKey(null));
});

import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

export type AiOperation =
  | "chat" | "learn" | "learn-check" | "quiz-generate" | "quiz-grade"
  | "flashcards-generate" | "practice-test-generate" | "practice-test-grade"
  | "document-process" | "document-reindex" | "topic-regenerate";

const RESERVATIONS_MICRO_USD: Record<AiOperation, number> = {
  chat: 20_000,
  learn: 20_000,
  "learn-check": 20_000,
  "quiz-generate": 75_000,
  "quiz-grade": 15_000,
  "flashcards-generate": 50_000,
  "practice-test-generate": 300_000,
  "practice-test-grade": 180_000,
  "document-process": 800_000,
  "document-reindex": 800_000,
  "topic-regenerate": 150_000
};

export function estimatedReservation(operation: AiOperation): number {
  return RESERVATIONS_MICRO_USD[operation];
}

/** Vercel overwrites incoming X-Forwarded-For; never trust a bare client header elsewhere. */
export function trustedClientIp(headers: Headers, vercel: boolean, development: boolean): string | null {
  if (!vercel) return development ? "127.0.0.1" : null;
  const candidate = headers.get("x-forwarded-for")?.trim() ?? "";
  if (!candidate || candidate.includes(",") || isIP(candidate) === 0) return null;
  return candidate;
}

export function hashedIp(ip: string, secret: string): string {
  if (!secret || secret.length < 32) throw new Error("AI admission IP hash secret is not configured");
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function requestKey(value: string | null): string {
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
    ? value.toLowerCase() : randomUUID();
}

export type AdmissionLimits = {
  userMinute: number;
  ipMinute: number;
  globalMinute: number;
  userConcurrent: number;
  ipConcurrent: number;
  globalConcurrent: number;
  userDailyMicroUsd: number;
  globalDailyMicroUsd: number;
};

/** Require explicit limits before enabling the feature. No silent unlimited defaults. */
export function admissionLimits(env: Record<string, string | undefined>): AdmissionLimits {
  function positive(name: string): number {
    const value = env[name];
    if (!value || !/^[0-9]+$/.test(value)) throw new Error("Missing or invalid " + name);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Missing or invalid " + name);
    return number;
  }
  return {
    userMinute: positive("STUDIGO_AI_USER_PER_MINUTE"),
    ipMinute: positive("STUDIGO_AI_IP_PER_MINUTE"),
    globalMinute: positive("STUDIGO_AI_GLOBAL_PER_MINUTE"),
    userConcurrent: positive("STUDIGO_AI_USER_CONCURRENT"),
    ipConcurrent: positive("STUDIGO_AI_IP_CONCURRENT"),
    globalConcurrent: positive("STUDIGO_AI_GLOBAL_CONCURRENT"),
    userDailyMicroUsd: positive("STUDIGO_AI_USER_DAILY_MICRO_USD"),
    globalDailyMicroUsd: positive("STUDIGO_AI_GLOBAL_DAILY_MICRO_USD")
  };
}

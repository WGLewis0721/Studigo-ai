export const DEFAULT_DAILY_CALL_CAP = 200;
export const DEFAULT_DAILY_TOKEN_CAP = 200_000;
export const DEFAULT_REINDEX_COOLDOWN_MS = 15 * 60 * 1000;

export function dailyCaps() {
  const calls = Number(process.env.STUDIGO_DAILY_CALL_CAP || DEFAULT_DAILY_CALL_CAP);
  const tokens = Number(process.env.STUDIGO_DAILY_TOKEN_CAP || DEFAULT_DAILY_TOKEN_CAP);
  return {
    calls: Number.isFinite(calls) && calls > 0 ? calls : DEFAULT_DAILY_CALL_CAP,
    tokens: Number.isFinite(tokens) && tokens > 0 ? tokens : DEFAULT_DAILY_TOKEN_CAP
  };
}

export function withinBudget(
  usage: { calls: number; tokens: number },
  caps: { calls: number; tokens: number }
) {
  return usage.calls <= caps.calls && usage.tokens <= caps.tokens;
}

export function reindexCooldownElapsed(lastMs: number | null, nowMs: number, cooldownMs: number) {
  if (cooldownMs <= 0) return true;
  if (lastMs == null || !Number.isFinite(lastMs)) return true;
  return nowMs - lastMs >= cooldownMs;
}

export function reindexCooldownMs() {
  const raw = process.env.STUDIGO_REINDEX_COOLDOWN_MS;
  if (raw == null || raw === "") return DEFAULT_REINDEX_COOLDOWN_MS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_REINDEX_COOLDOWN_MS;
}

type BudgetClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
};

export async function reserveAiBudget(supabase: BudgetClient, ownerId: string) {
  const caps = dailyCaps();
  const { data, error } = await supabase.rpc("consume_ai_budget", {
    p_owner_id: ownerId,
    p_calls: 1,
    p_tokens: 2000,
    p_max_calls: caps.calls,
    p_max_tokens: caps.tokens
  });
  if (error) return { ok: false as const, error: "Studigo could not check today's study limit. Try again shortly." };
  if (!data) return { ok: false as const, error: "Today's study limit is reached. It resets tomorrow." };
  return { ok: true as const };
}

export const COACH_MODES = ['show', 'coach', 'challenge'] as const;
export type CoachMode = typeof COACH_MODES[number];
export type ExplainLevel = 'simpler' | 'standard' | 'deeper';
export const COACH_MODE_LABELS: Record<CoachMode, string> = {
  show: 'Show me', coach: 'Coach me', challenge: 'Challenge me'
};
export function migrateCoachMode(value: unknown): CoachMode {
  if (!value || typeof value !== 'object') return 'coach';
  const raw = value as Record<string, unknown>;
  if (COACH_MODES.includes(raw.coach_mode as CoachMode)) return raw.coach_mode as CoachMode;
  if (raw.style === 'direct' || raw.style === 'visual') return 'show';
  if (raw.style === 'drill') return 'challenge';
  return 'coach';
}
/** Delivery preferences never change the reasoning ladder or rubric. */
export function deliverySupport(mode: CoachMode): 0 | 3 {
  return mode === 'show' ? 3 : 0;
}

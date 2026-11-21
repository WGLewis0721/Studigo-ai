/* Studigo's faces as targets on continuous channels (spec §3). The director
   crossfades between them; nothing here swaps a picture. */

export type Channels = {
  /** 1 is his normal open eye, 0 closed, above 1 wide. */
  eyeOpen: number;
  /** 0..1: the lower lid rises into a happy arc. */
  eyeSmile: number;
  /** 0..1: closes one eye only. */
  wink: number;
  /** -1 lowered and focused .. +1 raised. Drawn as the tilt of the upper lid. */
  brow: number;
  mouthCurve: number;
  mouthOpen: number;
  cheek: number;
  /** -1 frills back .. +1 frills up. */
  frill: number;
  /** One frill up, one down: his "curious" tell. */
  frillAsym: number;
  /** 0..1 amplitude of the tail wag. */
  tailWag: number;
  /** Scale of the tail flame, 1 at rest. */
  flame: number;
  /** Head roll, yaw and pitch offsets, each roughly -1..1. */
  tilt: number;
  yaw: number;
  pitch: number;
  /** Leans toward the learner. */
  lean: number;
  /** Chin up, chest out. */
  lift: number;
};

export const REST: Channels = {
  eyeOpen: 1, eyeSmile: 0, wink: 0, brow: 0, mouthCurve: 0, mouthOpen: 0, cheek: 0,
  frill: 0, frillAsym: 0, tailWag: 0, flame: 1, tilt: 0, yaw: 0, pitch: 0, lean: 0, lift: 0
};
export const CHANNEL_KEYS = Object.keys(REST) as (keyof Channels)[];

const face = (over: Partial<Channels>): Channels => ({ ...REST, ...over });

export const EXPRESSIONS = {
  Sunny: face({ mouthCurve: 0.25, tailWag: 0.18, cheek: 0.15 }),
  Curious: face({ eyeOpen: 1.1, brow: 0.5, tilt: 0.55, frill: 0.4, frillAsym: 0.8, lean: 0.35 }),
  Thinking: face({ eyeOpen: 0.92, brow: 0.3, yaw: -0.35, pitch: -0.45, tilt: 0.25, mouthCurve: -0.1, flame: 0.9 }),
  Focused: face({ eyeOpen: 0.72, brow: -0.7, lean: 0.25, flame: 0.95, frill: -0.2 }),
  Wow: face({ eyeOpen: 1.32, brow: 1, mouthOpen: 0.55, frill: 1, flame: 1.25, lift: 0.3 }),
  Proud: face({ eyeOpen: 0.9, eyeSmile: 0.35, brow: 0.2, mouthCurve: 0.6, pitch: -0.4, lift: 0.8, frill: 0.5, tailWag: 0.45, flame: 1.2, cheek: 0.3 }),
  Giggly: face({ eyeOpen: 0.5, eyeSmile: 1, mouthCurve: 0.8, mouthOpen: 0.35, cheek: 0.6, tailWag: 0.8, frill: 0.3, flame: 1.15 }),
  HeartEyes: face({ eyeOpen: 1.15, eyeSmile: 0.3, mouthCurve: 0.7, cheek: 1, tailWag: 0.6, frill: 0.4, tilt: 0.2 }),
  Winky: face({ wink: 1, eyeSmile: 0.4, mouthCurve: 0.6, tilt: 0.3, cheek: 0.3, tailWag: 0.3 }),
  Sleepy: face({ eyeOpen: 0.38, brow: -0.2, pitch: 0.45, frill: -0.5, flame: 0.72, mouthOpen: 0.1 }),
  Oopsie: face({ eyeOpen: 1.05, eyeSmile: 0.25, brow: 0.6, mouthCurve: 0.3, frill: -0.8, tilt: -0.3, cheek: 0.4, flame: 0.9 }),
  Hmm: face({ eyeOpen: 0.95, brow: 0.35, tilt: -0.4, mouthCurve: -0.15, frillAsym: -0.5, yaw: 0.2 }),
  Brave: face({ eyeOpen: 0.88, brow: -0.4, mouthCurve: 0.5, pitch: -0.3, lift: 1, frill: 0.8, flame: 1.4, tailWag: 0.3 }),
  Cozy: face({ eyeOpen: 0.82, eyeSmile: 0.2, mouthCurve: 0.2, frill: -0.2, flame: 0.85, cheek: 0.2 })
} as const satisfies Record<string, Channels>;

export type ExpressionName = keyof typeof EXPRESSIONS;
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS) as ExpressionName[];

export function mix(from: Channels, to: Channels, amount: number, out: Channels): Channels {
  for (const key of CHANNEL_KEYS) out[key] = from[key] + (to[key] - from[key]) * amount;
  return out;
}

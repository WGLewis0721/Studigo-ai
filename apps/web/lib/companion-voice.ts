/* Studigo's voice (LC-DEC-042): one short spoken line at a time, in the Benji take-B voice.

   Pure. The caller passes the moment, the planner's memory and the clock; nothing here
   plays audio. The engine owns the audio element and the mouth. */

import type { CompanionEvent } from "./companion-logic";

export type VoiceLineId =
  | "oh-youre-here-early" | "got-a-test" | "whatever-your-teacher" | "ask-me-something" | "ill-show-you-the-page"
  | "stuck-okay" | "one-step-at-a-time" | "your-turn" | "how-sure" | "nice" | "you-knew-that-one"
  | "im-studigo" | "im-coming-with-you" | "come-on";

export type VoiceLine = { id: VoiceLineId; src: string; text: string; maxMs?: number };

/** Every clip in public/mascot/voice. `text` is what the bubble shows while it plays; `maxMs` cuts a clip that runs on past the script. */
export const VOICE_LINES: readonly VoiceLine[] = [
  { id: "oh-youre-here-early", src: "/mascot/voice/oh-youre-here-early.mp3", text: "Oh! You're here early!" },
  { id: "got-a-test", src: "/mascot/voice/got-a-test.mp3", text: "Got a test? Hand over the study guide!" },
  { id: "whatever-your-teacher", src: "/mascot/voice/whatever-your-teacher.mp3", text: "Whatever your teacher handed out.", maxMs: 2000 },
  { id: "ask-me-something", src: "/mascot/voice/ask-me-something.mp3", text: "Ask me something!" },
  { id: "ill-show-you-the-page", src: "/mascot/voice/ill-show-you-the-page.mp3", text: "I'll show you the page!" },
  { id: "stuck-okay", src: "/mascot/voice/stuck-okay.mp3", text: "Stuck? Okay." },
  { id: "one-step-at-a-time", src: "/mascot/voice/one-step-at-a-time.mp3", text: "One step at a time." },
  { id: "your-turn", src: "/mascot/voice/your-turn.mp3", text: "Your turn!" },
  { id: "how-sure", src: "/mascot/voice/how-sure.mp3", text: "Tell me how sure you are!" },
  { id: "nice", src: "/mascot/voice/nice.mp3", text: "Nice." },
  { id: "you-knew-that-one", src: "/mascot/voice/you-knew-that-one.mp3", text: "You knew that one!" },
  { id: "im-studigo", src: "/mascot/voice/im-studigo.mp3", text: "I'm Studigo." },
  { id: "im-coming-with-you", src: "/mascot/voice/im-coming-with-you.mp3", text: "I'm coming with you!" },
  { id: "come-on", src: "/mascot/voice/come-on.mp3", text: "Come on!" }
];

const BY_ID = new Map<VoiceLineId, VoiceLine>(VOICE_LINES.map((line) => [line.id, line]));

export function voiceLine(id: VoiceLineId): VoiceLine {
  const line = BY_ID.get(id);
  if (!line) throw new Error(`Studigo has no voice line called ${id}`);
  return line;
}

/** What just happened, as the voice sees it. A room moment carries a roll in [0, 1) that the caller draws. */
export type VoiceMoment =
  | { kind: "correct"; streak: number }
  | { kind: "cardGood"; streak: number }
  | { kind: "stall"; level: 1 | 2 }
  | { kind: "room"; room: "coach" | "materials"; roll: number }
  | { kind: "setDone" | "missionComplete" | "sessionReturn" | "wrong" | "blindspot" | "cardMiss" | "hintOpened" | "firstMeet" | "summon" };

/** The committed event a voice moment comes from, with the counts the voice needs. Events that have no line return null. */
export function momentFor(event: CompanionEvent, counts: { streak: number; cardStreak: number; level?: 1 | 2 }): VoiceMoment | null {
  switch (event) {
    case "correct": return { kind: "correct", streak: counts.streak };
    case "cardGood": return { kind: "cardGood", streak: counts.cardStreak };
    case "stall": return { kind: "stall", level: counts.level === 2 ? 2 : 1 };
    case "setDone": case "missionComplete": case "sessionReturn": case "wrong": case "blindspot": case "cardMiss": case "hintOpened":
      return { kind: event };
    case "correctFast": return null;
  }
}

/** Streaks that get their own line instead of the routine one. */
export const MILESTONE_STREAKS: readonly number[] = [3, 5, 10];
/** Two lines never start closer together than this. */
export const VOICE_COOLDOWN_MS = 12_000;
/** The routine "Nice." is capped to one per this long. Milestones and the first meeting are not. */
export const ROUTINE_CORRECT_GAP_MS = 45_000;

/** The planner's memory. Start from VOICE_START and keep the state `planVoice` returns. */
export type VoiceState = { last: VoiceLineId | null; lastAt: number; routineCorrectAt: number };
export const VOICE_START: VoiceState = { last: null, lastAt: -Infinity, routineCorrectAt: -Infinity };

/**
 * priority: always starts (the first meeting, a summon). milestone: obeys the cooldown.
 * routineCorrect: obeys the cooldown and the routine cap. routine: obeys the cooldown.
 */
type Rank = "priority" | "milestone" | "routine" | "routineCorrect";
type Plan = { id: VoiceLineId; rank: Rank };

function lineFor(moment: VoiceMoment): Plan | null {
  switch (moment.kind) {
    case "firstMeet": return { id: "im-studigo", rank: "priority" };
    case "summon": return { id: "im-coming-with-you", rank: "priority" };
    case "correct": return MILESTONE_STREAKS.includes(moment.streak)
      ? { id: "you-knew-that-one", rank: "milestone" }
      : { id: "nice", rank: "routineCorrect" };
    case "cardGood": return MILESTONE_STREAKS.includes(moment.streak) ? { id: "you-knew-that-one", rank: "milestone" } : null;
    case "setDone": return { id: "you-knew-that-one", rank: "milestone" };
    case "missionComplete": return { id: "come-on", rank: "milestone" };
    case "sessionReturn": return { id: "oh-youre-here-early", rank: "milestone" };
    case "wrong": case "blindspot": case "cardMiss": return { id: "one-step-at-a-time", rank: "routine" };
    case "stall": return { id: moment.level === 2 ? "your-turn" : "stuck-okay", rank: "routine" };
    case "hintOpened": return { id: "your-turn", rank: "routine" };
    case "room": {
      // Occasionally, not every time he is out: half the roll range speaks.
      if (moment.roll >= 0.5) return null;
      const first = moment.roll < 0.25;
      if (moment.room === "coach") return { id: first ? "got-a-test" : "ask-me-something", rank: "routine" };
      return { id: first ? "ill-show-you-the-page" : "whatever-your-teacher", rank: "routine" };
    }
  }
}

/** The line to say now, and the memory to keep, or null when the moment should stay quiet. */
export function planVoice(moment: VoiceMoment, state: VoiceState, now: number): { id: VoiceLineId; state: VoiceState } | null {
  const plan = lineFor(moment);
  if (!plan) return null;
  if (plan.rank !== "priority") {
    if (now - state.lastAt < VOICE_COOLDOWN_MS) return null;
    if (plan.id === state.last) return null;
    if (plan.rank === "routineCorrect" && now - state.routineCorrectAt < ROUTINE_CORRECT_GAP_MS) return null;
  }
  const routineCorrectAt = plan.rank === "routineCorrect" ? now : state.routineCorrectAt;
  return { id: plan.id, state: { last: plan.id, lastAt: now, routineCorrectAt } };
}

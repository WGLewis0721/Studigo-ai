import { selectLearningRoute } from "./coach-route-selection";

export type CoachPreferences = {
  style: string;
  tradition: string;
  practice: string;
  explainLevel: "simpler" | "standard" | "deeper";
};

export const DEFAULT_COACH_PREFERENCES: CoachPreferences = {
  style: "default", tradition: "tradition-default", practice: "adaptive", explainLevel: "standard"
};

/** IDs are the persisted contract. Instructions always come from application code. */
export function normalizeCoachPreferences(input: unknown, explainLevel: unknown = "standard"): CoachPreferences {
  const raw = input && typeof input === "object" ? input as Partial<CoachPreferences> : {};
  return {
    style: STYLES.find(option => option.id === raw.style)?.id ?? "default",
    tradition: TRADITIONS.find(option => option.id === raw.tradition)?.id ?? "tradition-default",
    practice: PRACTICE_PROTOCOLS.find(option => option.id === raw.practice)?.id ?? "adaptive",
    explainLevel: explainLevel === "simpler" || explainLevel === "deeper" ? explainLevel : "standard"
  };
}

export function validCoachPreferences(input: unknown): input is CoachPreferences {
  if (!input || typeof input !== "object") return false;
  const raw = input as CoachPreferences;
  const normalized = normalizeCoachPreferences(raw, raw.explainLevel);
  return Object.keys(DEFAULT_COACH_PREFERENCES).every(key => raw[key as keyof CoachPreferences] === normalized[key as keyof CoachPreferences]);
}

export function sameCoachPreferences(a: CoachPreferences, b: CoachPreferences): boolean {
  return a.style === b.style && a.tradition === b.tradition && a.practice === b.practice && a.explainLevel === b.explainLevel;
}

/** Recalibration is deterministic: no model call, grading or encounter reset. */
export function compileCoachPreferences(preferences: CoachPreferences) {
  const style = STYLES.find(option => option.id === preferences.style) ?? STYLES[0];
  const tradition = TRADITIONS.find(option => option.id === preferences.tradition) ?? TRADITIONS[0];
  const practice = PRACTICE_PROTOCOLS.find(option => option.id === preferences.practice) ?? PRACTICE_PROTOCOLS[0];
  const levels = {
    simpler: "Use plain everyday words, short sentences and familiar examples. Explain a technical term when it first appears.",
    standard: "Explain at the level of the uploaded material, keeping sentences clear and concise.",
    deeper: "Use precise subject vocabulary and explain connections in more depth. Keep the question itself concise."
  };
  return {
    route: selectLearningRoute(style.id, tradition.id),
    directives: [
      { name: "Coaching style", instruction: style.instruction },
      { name: "Learning tradition", instruction: tradition.instruction },
      { name: "Practice protocol", instruction: practice.instruction },
      { name: "Explanation level", instruction: `${levels[preferences.explainLevel]} Change delivery only; keep the same source facts, concepts, reasoning demand and grading standard.` },
      { name: "How these combine", instruction: `The coaching style (${style.name}) sets the shape of each turn. The learning tradition (${tradition.name}) sets the order ideas are introduced in. The explanation level sets only the wording. Make the style visible in every reply: ${style.expect}` }
    ]
  };
}

export type CoachingStyle = {
  id: string;
  name: string;
  /** What the learner will notice in replies, in plain words. Shown in the UI. */
  expect: string;
  description: string;
  instruction: string;
};

export const STYLES: CoachingStyle[] = [
  { id: "default", name: "Studigo default", expect: "A short explanation, one example, then a problem for you to try.", description: "Clear explanation, example, guided practice", instruction: "Use a balanced coach loop: explain briefly, demonstrate one example, ask the learner to try, diagnose the mistake, then assign the next best practice." },
  { id: "direct", name: "Direct instruction", expect: "Worked examples first. Studigo shows you how, then corrects one thing at a time.", description: "Worked examples, correction, repetition", instruction: "Teach directly. Show worked examples, give one precise correction at a time, and use deliberate repetition until the learner is accurate." },
  { id: "drill", name: "Deliberate practice", expect: "Many quick problems on one skill, with instant feedback after each.", description: "Targeted reps that build automaticity", instruction: "Use deliberate practice when it fits: isolate one skill, give a carefully targeted sequence of up to 50 problems one at a time, vary difficulty gradually, give immediate specific feedback, and revisit errors. Do not assign busywork." },
  { id: "socratic", name: "Socratic coach", expect: "Mostly questions. Studigo will not hand you the answer; you reason it out.", description: "Questions that make the learner reason", instruction: "Ask short guiding questions instead of giving the answer. Let the learner explain their reasoning, then correct the exact misconception." },
  { id: "progression", name: "Skill progression", expect: "The skill split into small steps, practiced one step at a time, then put together.", description: "Small parts, connected phrases, performance", instruction: "Break the skill into small parts, demonstrate the complete performance, coach one part at a time, connect the parts, then test transfer in a new context. Correct, repeat, and increase challenge only after evidence of mastery." },
  { id: "visual", name: "Concrete to abstract", expect: "A picture, model or real example first, then the formal idea and terms.", description: "Models, diagrams, then symbols", instruction: "Start with a concrete or visual model, connect it to the idea, and only then move to symbolic or abstract practice. Keep the teacher's terminology." }
];

export const TRADITIONS: CoachingStyle[] = [
  { id: "tradition-default", name: "Teacher's method", expect: "Your teacher's wording, steps and examples, exactly as the guide has them.", description: "Stay faithful to the uploaded guide", instruction: "Prioritize the teacher's stated method, vocabulary, scope, and examples. Never replace the teacher's requirements with a different tradition." },
  { id: "tradition-japanese", name: "Japanese-inspired", expect: "One method studied carefully, you explain why it works, then a short reflection.", description: "Mastery, careful modeling, steady improvement", instruction: "Use a Japanese-inspired lesson rhythm: make the goal explicit, study one worked method carefully, ask the learner to explain the reasoning, practice a small progression, and reflect on one improvement. Treat errors as information, not failure." },
  { id: "tradition-swedish", name: "Swedish-inspired", expect: "You compare approaches, question assumptions and pick your next step.", description: "Curiosity, independence, critical thinking", instruction: "Use a Swedish-inspired approach: invite the learner to question assumptions, compare strategies, explain evidence, and choose a next step. Preserve structure and accountability while giving the learner meaningful agency." },
  { id: "tradition-singapore", name: "Singapore Math-inspired", expect: "Objects, then a drawing or bar model, then numbers and symbols.", description: "Concrete, pictorial, abstract", instruction: "For math, move deliberately from concrete objects or a bar/model representation to a drawing and then symbols. Ask the learner to connect each representation before increasing complexity." },
  { id: "tradition-montessori", name: "Montessori-inspired", expect: "You choose from a few tasks and check your own work before seeing the fix.", description: "Choice within a prepared sequence", instruction: "Offer a bounded choice of practice, let the learner attempt independently, use precise hands-off prompts, and reveal the correction only after self-checking. Keep the objective and teacher scope fixed." }
];

type PracticeProtocol = { id: string; name: string; expect: string; instruction: string };

export const PRACTICE_PROTOCOLS: PracticeProtocol[] = [
  { id: "adaptive", name: "Best next practice", expect: "The next task is chosen from your last answer.", instruction: "Choose the smallest next task that reveals understanding. Use retrieval, a worked example, or a transfer problem based on the learner's last response." },
  { id: "repetition", name: "Focused repetition", expect: "Similar items in a row until it is automatic.", instruction: "Use straightforward repetition when automaticity is the goal. Keep the target narrow, generate varied but equivalent items, give immediate feedback, and stop or reteach when the same error repeats." },
  { id: "transfer", name: "Transfer practice", expect: "The same idea in new situations, so you choose the method yourself.", instruction: "After a learner can perform the modeled skill, vary the surface features and context so they must choose and apply the method, not just copy a pattern." }
] as const;

export const EXPLAIN_LEVEL_LABELS: Record<CoachPreferences["explainLevel"], string> = {
  simpler: "Simpler words", standard: "Standard words", deeper: "Deeper detail"
};

/**
 * One plain description of how replies will feel, so the learner can tell the
 * settings apart. Style decides the shape of a turn, tradition the order ideas
 * come in, and the room's explanation level only the wording.
 */
export function describeCoaching(preferences: CoachPreferences) {
  const style = STYLES.find(option => option.id === preferences.style) ?? STYLES[0];
  const tradition = TRADITIONS.find(option => option.id === preferences.tradition) ?? TRADITIONS[0];
  const practice = PRACTICE_PROTOCOLS.find(option => option.id === preferences.practice) ?? PRACTICE_PROTOCOLS[0];
  return {
    label: `${style.name} · ${tradition.name}`,
    level: EXPLAIN_LEVEL_LABELS[preferences.explainLevel],
    style, tradition, practice
  };
}

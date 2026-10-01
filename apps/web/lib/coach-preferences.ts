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
      { name: "Explanation level", instruction: `${levels[preferences.explainLevel]} Change delivery only; keep the same source facts, concepts, reasoning demand and grading standard.` }
    ]
  };
}

export type CoachingStyle = {
  id: string;
  name: string;
  description: string;
  instruction: string;
};

export const STYLES: CoachingStyle[] = [
  { id: "default", name: "Studigo default", description: "Clear explanation, example, guided practice", instruction: "Use a balanced coach loop: explain briefly, demonstrate one example, ask the learner to try, diagnose the mistake, then assign the next best practice." },
  { id: "direct", name: "Direct instruction", description: "Worked examples, correction, repetition", instruction: "Teach directly. Show worked examples, give one precise correction at a time, and use deliberate repetition until the learner is accurate." },
  { id: "drill", name: "Deliberate practice", description: "Targeted reps that build automaticity", instruction: "Use deliberate practice when it fits: isolate one skill, give a carefully targeted sequence of up to 50 problems one at a time, vary difficulty gradually, give immediate specific feedback, and revisit errors. Do not assign busywork." },
  { id: "socratic", name: "Socratic coach", description: "Questions that make the learner reason", instruction: "Ask short guiding questions instead of giving the answer. Let the learner explain their reasoning, then correct the exact misconception." },
  { id: "progression", name: "Skill progression", description: "Small parts, connected phrases, performance", instruction: "Break the skill into small parts, demonstrate the complete performance, coach one part at a time, connect the parts, then test transfer in a new context. Correct, repeat, and increase challenge only after evidence of mastery." },
  { id: "visual", name: "Concrete to abstract", description: "Models, diagrams, then symbols", instruction: "Start with a concrete or visual model, connect it to the idea, and only then move to symbolic or abstract practice. Keep the teacher's terminology." }
];

export const TRADITIONS: CoachingStyle[] = [
  { id: "tradition-default", name: "Teacher's method", description: "Stay faithful to the uploaded guide", instruction: "Prioritize the teacher's stated method, vocabulary, scope, and examples. Never replace the teacher's requirements with a different tradition." },
  { id: "tradition-japanese", name: "Japanese-inspired", description: "Mastery, careful modeling, steady improvement", instruction: "Use a Japanese-inspired lesson rhythm: make the goal explicit, study one worked method carefully, ask the learner to explain the reasoning, practice a small progression, and reflect on one improvement. Treat errors as information, not failure." },
  { id: "tradition-swedish", name: "Swedish-inspired", description: "Curiosity, independence, critical thinking", instruction: "Use a Swedish-inspired approach: invite the learner to question assumptions, compare strategies, explain evidence, and choose a next step. Preserve structure and accountability while giving the learner meaningful agency." },
  { id: "tradition-singapore", name: "Singapore Math-inspired", description: "Concrete, pictorial, abstract", instruction: "For math, move deliberately from concrete objects or a bar/model representation to a drawing and then symbols. Ask the learner to connect each representation before increasing complexity." },
  { id: "tradition-montessori", name: "Montessori-inspired", description: "Choice within a prepared sequence", instruction: "Offer a bounded choice of practice, let the learner attempt independently, use precise hands-off prompts, and reveal the correction only after self-checking. Keep the objective and teacher scope fixed." }
];

type PracticeProtocol = { id: string; name: string; instruction: string };

export const PRACTICE_PROTOCOLS: PracticeProtocol[] = [
  { id: "adaptive", name: "Best next practice", instruction: "Choose the smallest next task that reveals understanding. Use retrieval, a worked example, or a transfer problem based on the learner's last response." },
  { id: "repetition", name: "Focused repetition", instruction: "Use straightforward repetition when automaticity is the goal. Keep the target narrow, generate varied but equivalent items, give immediate feedback, and stop or reteach when the same error repeats." },
  { id: "transfer", name: "Transfer practice", instruction: "After a learner can perform the modeled skill, vary the surface features and context so they must choose and apply the method, not just copy a pattern." }
] as const;

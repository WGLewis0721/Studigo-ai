import { selectLearningRoute } from "./coach-route-selection";
import referenceJson from "./generated/teaching-references.json";
import type { TeachingReferences } from "./teaching-reference-projection";
import { COACH_MODES, migrateCoachMode, COACH_MODE_LABELS, type CoachMode } from "@studigo/learning";

const REFERENCES = referenceJson as TeachingReferences;
export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** Hard caps on what the references add to a prompt, so replies stay fast. */
export const REFERENCE_WORD_BUDGET = { coach: 480, level: 110 };

export type CoachPreferences = {
  /** V3 learner-facing control. Legacy fields remain persisted for rollback/backward compatibility. */
  coach_mode?: CoachMode;
  style: string;
  tradition: string;
  practice: string;
  explainLevel: "simpler" | "standard" | "deeper";
};

export const COACH_MODE_OPTIONS: ReadonlyArray<{ id: CoachMode; name: string; expect: string }> = [
  { id: "show", name: COACH_MODE_LABELS.show, expect: "Explain it first, show me an example, then let me try." },
  { id: "coach", name: COACH_MODE_LABELS.coach, expect: "Guide me with questions, hints, and feedback." },
  { id: "challenge", name: COACH_MODE_LABELS.challenge, expect: "Start with less help and make me apply what I know." }
];

export const DEFAULT_COACH_PREFERENCES: CoachPreferences = {
  coach_mode: "coach", style: "default", tradition: "tradition-default", practice: "adaptive", explainLevel: "standard"
};

/** The room's explanation level as rules plus the same idea written at that level. Coach and Learn. */
export function levelReference(level: CoachPreferences["explainLevel"]): string {
  const ref = REFERENCES.levels[level];
  if (!ref) return "";
  return `Rules for this level: ${ref.rules.join(" ")} Same idea at this level: "${ref.sample}"`;
}

/**
 * The research library remains available internally even though V3 no longer
 * exposes style/tradition/practice controls to learners.
 */
export function teachingReference(preferences: CoachPreferences): string {
  const style = REFERENCES.styles[preferences.style];
  const tradition = REFERENCES.traditions[preferences.tradition];
  const practice = REFERENCES.practice[preferences.practice];
  const model = REFERENCES.exemplars[`style:${preferences.style}:${preferences.explainLevel}`];
  const traditionModel = preferences.tradition === "tradition-default" ? undefined : REFERENCES.exemplars[`tradition:${preferences.tradition}`];
  const lines = [
    "Use these as a pattern for the shape of your reply. The model replies use a sample topic: copy their moves, never their facts. Every fact comes only from the excerpts.",
    style && `Style, ${style.label}. Moves in order: ${style.sequence.slice(0, 5).join(" ")} Rules: ${style.rules.slice(0, 3).join(" ")}`,
    tradition && `Tradition, ${tradition.label}. Order of ideas: ${tradition.sequence.slice(0, 4).join(" ")} Rules: ${tradition.rules.slice(0, 2).join(" ")}`,
    practice && `Practice, ${practice.label}: ${practice.rules.slice(0, 2).join(" ")}`,
    model && `Model reply for this style at this level:\n"""\n${model.reply}\n"""\nWhy it works: ${model.why.join(" ")} Avoid: ${model.avoid.join(" ")}`,
    traditionModel && `How this tradition changes a reply:\n"""\n${traditionModel.reply}\n"""`,
    "The level changes wording only. Never change source truth, the issued task, reasoning demand, or grading."
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export type CoachingStyle = {
  id: string;
  name: string;
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

function validLegacy(raw: Partial<CoachPreferences>) {
  return {
    style: STYLES.find(option => option.id === raw.style)?.id ?? "default",
    tradition: TRADITIONS.find(option => option.id === raw.tradition)?.id ?? "tradition-default",
    practice: PRACTICE_PROTOCOLS.find(option => option.id === raw.practice)?.id ?? "adaptive"
  };
}

/** Convert an old room or a new V3 choice into one explicit persistent mode. */
export function normalizeCoachPreferences(input: unknown, explainLevel: unknown = "standard"): CoachPreferences {
  const raw = input && typeof input === "object" ? input as Partial<CoachPreferences> : {};
  const legacy = validLegacy(raw);
  const coach_mode = COACH_MODES.includes(raw.coach_mode as CoachMode)
    ? raw.coach_mode as CoachMode
    : migrateCoachMode({ ...raw, ...legacy });
  return {
    coach_mode,
    ...legacy,
    explainLevel: explainLevel === "simpler" || explainLevel === "deeper" ? explainLevel : "standard"
  };
}

/**
 * Hidden legacy fields remain only because the current DB constraint requires
 * them. New Apply writes canonical internal values so old learner choices no
 * longer secretly steer V3.
 */
export function canonicalCoachPreferences(preferences: CoachPreferences): CoachPreferences {
  const mode = migrateCoachMode(preferences);
  const legacy = mode === "show"
    ? { style: "direct", tradition: "tradition-default", practice: "adaptive" }
    : mode === "challenge"
      ? { style: "default", tradition: "tradition-default", practice: "transfer" }
      : { style: "default", tradition: "tradition-default", practice: "adaptive" };
  return { coach_mode: mode, ...legacy, explainLevel: preferences.explainLevel };
}

export function validCoachPreferences(input: unknown): input is CoachPreferences {
  if (!input || typeof input !== "object") return false;
  const raw = input as CoachPreferences;
  if (raw.coach_mode !== undefined && !COACH_MODES.includes(raw.coach_mode)) return false;
  const normalized = normalizeCoachPreferences(raw, raw.explainLevel);
  return raw.style === normalized.style
    && raw.tradition === normalized.tradition
    && raw.practice === normalized.practice
    && raw.explainLevel === normalized.explainLevel;
}

export function sameCoachPreferences(a: CoachPreferences, b: CoachPreferences): boolean {
  return migrateCoachMode(a) === migrateCoachMode(b) && a.explainLevel === b.explainLevel;
}

/** Recalibration is deterministic: no model call, grading or encounter reset. */
export function compileCoachPreferences(preferences: CoachPreferences) {
  const effective = canonicalCoachPreferences(preferences);
  const mode = effective.coach_mode ?? "coach";
  const style = STYLES.find(option => option.id === effective.style) ?? STYLES[0];
  const tradition = TRADITIONS.find(option => option.id === effective.tradition) ?? TRADITIONS[0];
  const practice = PRACTICE_PROTOCOLS.find(option => option.id === effective.practice) ?? PRACTICE_PROTOCOLS[0];
  const levels = {
    simpler: "Use plain everyday words, short sentences and familiar examples. Explain a technical term when it first appears.",
    standard: "Explain at the level of the uploaded material, keeping sentences clear and concise.",
    deeper: "Use precise subject vocabulary and explain connections in more depth. Keep the question itself concise."
  };
  const modeInstruction = mode === "show"
    ? "mode=show. Give a brief grounded explanation and one representative example before the learner attempts the issued task. Record delivered assistance. Preserve the task, rubric and reasoning demand."
    : mode === "challenge"
      ? "mode=challenge. Begin with less help, but preserve director-required scaffolds and task size. This mode never requests a harder rung or changes grading. Hints remain available."
      : "mode=coach. Let the learner try the issued task, observe the response, and offer grounded help when needed. Preserve reasoning demand and grading.";
  return {
    mode,
    route: selectLearningRoute(style.id, tradition.id),
    directives: [
      { name: "Coach mode", instruction: modeInstruction },
      { name: "Internal coaching strategy", instruction: `${style.instruction} ${practice.instruction}` },
      { name: "Source fidelity", instruction: tradition.instruction },
      { name: "Explanation level", instruction: `${levels[effective.explainLevel]} Change delivery only; keep the same source facts, concepts, reasoning demand and grading standard. ${levelReference(effective.explainLevel)}`.trim() },
      { name: "Teaching reference", instruction: teachingReference(effective) }
    ]
  };
}

export function describeCoaching(preferences: CoachPreferences) {
  const mode = migrateCoachMode(preferences);
  const option = COACH_MODE_OPTIONS.find(item => item.id === mode) ?? COACH_MODE_OPTIONS[1];
  return {
    mode,
    label: option.name,
    expect: option.expect,
    level: EXPLAIN_LEVEL_LABELS[preferences.explainLevel]
  };
}

type Directive = { name: string; instruction: string };
/**
 * Coach gets its saved mode plus internal strategy and the global room level.
 * Learn gets only the global room level plus topic context.
 */
export function directivesForTurn(mode: "coach" | "ask", preferences: CoachPreferences, clientDirectives: Directive[] = []) {
  const compiled = compileCoachPreferences(preferences);
  if (mode === "coach") return compiled.directives;
  const topic = clientDirectives.filter(item => item.name === "Current topic");
  return [...topic, compiled.directives.find(item => item.name === "Explanation level")!];
}

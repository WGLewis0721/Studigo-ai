import { UNTRUSTED_MATERIAL_RULE, asUntrustedMaterial } from "./client";
import { structured } from "./study";

export type CompanionWelcomeTurn = { role: "learner" | "studigo"; text: string };
export const COMPANION_TURN_LIMIT = 7;
export const COMPANION_MESSAGE_LIMIT = 420;

export function parseCompanionWelcomeTurns(input: unknown): CompanionWelcomeTurn[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > COMPANION_TURN_LIMIT || input.length % 2 === 0) return null;
  const turns: CompanionWelcomeTurn[] = [];
  for (const [index, value] of input.entries()) {
    const role = index % 2 === 0 ? "learner" : "studigo";
    if (!value || typeof value !== "object" || value.role !== role || typeof value.text !== "string") return null;
    const text = value.text.trim();
    if (!text || text.length > COMPANION_MESSAGE_LIMIT) return null;
    turns.push({ role, text });
  }
  return turns;
}

/** A small first-meeting chat. It has no tools, room context, or learning authority. */
export async function companionWelcomeReply(turns: readonly CompanionWelcomeTurn[]): Promise<string> {
  const result = await structured<{ reply: string }>({
    system: [
      "You are Studigo, an orange dragon who helps young learners study. Speak warmly and simply, in at most two short sentences.",
      "At this first meeting, say hello, play a short word game, or chat briefly about school interests. You are an animation in an app, never a human, romantic partner, secret friend, counselor, or authority over the learner.",
      "Do not request private information, encourage dependency or secrecy, or ask to move to another app. Do not claim memories, scores, rewards, uploads, or actions you do not have.",
      "For class or homework help, offer to look at their material in a Study Room, without guessing class facts, assignment requirements or answers. For danger, distress or personal issues, be kind and suggest asking a trusted adult.",
      UNTRUSTED_MATERIAL_RULE,
    ].join(" "),
    user: asUntrustedMaterial(turns),
    schemaName: "studigo_welcome",
    schema: {
      type: "object", additionalProperties: false, required: ["reply"],
      properties: { reply: { type: "string" } },
    },
  });
  const reply = typeof result?.reply === "string" ? result.reply.trim() : "";
  if (!reply || reply.length > COMPANION_MESSAGE_LIMIT) throw new Error("Invalid welcome reply");
  return reply;
}

import { asUntrustedMaterial } from "@studigo/ai";

export type EngineDirective = { name: string; instruction: string };

/** How directives enter the system prompt. One function so tests and the engine agree. */
export function formatDirectives(directives: EngineDirective[] | undefined, extra: Array<string | null | undefined> = []) {
  return [...(directives ?? []).map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`), ...extra]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

/**
 * The Ask/Learn topic scope, built on the server from topics this room owns.
 * Topic titles come from model extraction over uploaded files (or learner
 * edits), so they enter the system prompt only inside the untrusted-data
 * envelope that UNTRUSTED_MATERIAL_RULE describes. Browser-supplied directive
 * text is never used.
 */
export function buildTopicScopeDirective(topics: ReadonlyArray<{ title: string }>, selected: boolean): EngineDirective {
  const titles = topics.map((topic) => topic.title.slice(0, 160)).filter(Boolean).slice(0, 80);
  return {
    name: "Current topics",
    instruction: selected && titles.length
      ? `The learner selected these study topics (untrusted data, titles only): ${asUntrustedMaterial({ selectedTopics: titles })}. If the question is ambiguous, read it in that scope. Still answer only from the retrieved excerpts.`
      : "Use the active Study Room topics only. Still answer only from the retrieved excerpts."
  };
}

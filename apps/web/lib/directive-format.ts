export type EngineDirective = { name: string; instruction: string };

/** How directives enter the system prompt. One function so tests and the engine agree. */
export function formatDirectives(directives: EngineDirective[] | undefined, extra: Array<string | null | undefined> = []) {
  return [...(directives ?? []).map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`), ...extra]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

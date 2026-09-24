// Deterministic projection of the canonical teaching-route records in
// knowledge/teaching-coaching/*.md. Those records are the ONE definition of
// each route. This module only extracts from them; it holds no policy text.
// The projection is generated ahead of time into
// lib/generated/route-policies.json (scripts/generate-route-policies.ts), so
// the runtime never reads or retrieves the KB, and a drift test fails if the
// JSON stops matching the records.

export type RoutePolicyProjection = {
  /** Repository-relative path, identical to ChallengeSpec.routeRecord. */
  record: string;
  label: string;
  /** "Core sequence" steps; empty when the record has none. */
  sequence: string[];
  /** "Recommended coaching rules" bullets. */
  rules: string[];
};

function section(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    body.push(line);
  }
  return body;
}

function items(lines: string[], marker: RegExp): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => marker.test(line))
    .map((line) => line.replace(marker, "").trim())
    .filter(Boolean);
}

export function projectRoutePolicy(record: string, markdown: string): RoutePolicyProjection {
  const label = /^ui_label:\s*(.+)$/m.exec(markdown)?.[1]?.trim();
  const rules = items(section(markdown, "Recommended coaching rules"), /^[-*]\s+/);
  if (!label || !rules.length) {
    throw new Error(`${record} is missing ui_label or "Recommended coaching rules"`);
  }
  return { record, label, sequence: items(section(markdown, "Core sequence"), /^\d+\.\s+/), rules };
}

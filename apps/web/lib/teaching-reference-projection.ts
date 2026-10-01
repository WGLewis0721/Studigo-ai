// Build-time projection of knowledge/teaching-coaching (records, reference
// replies and explanation levels) into a compact JSON the runtime bundles.
// No KB is read or searched at request time, so this adds no latency.

export type OptionReference = { label: string; sequence: string[]; rules: string[] };
export type ExemplarReference = { reply: string; why: string[]; avoid: string[] };
export type LevelReference = { label: string; rules: string[]; sample: string; avoid: string[] };
export type TeachingReferences = {
  styles: Record<string, OptionReference>;
  traditions: Record<string, OptionReference>;
  practice: Record<string, OptionReference>;
  levels: Record<string, LevelReference>;
  /** Keys: "style:<id>:<level>", "tradition:<id>", "practice:<id>". */
  exemplars: Record<string, ExemplarReference>;
};

const front = (md: string, key: string) => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(md)?.[1]?.trim();
function section(md: string, heading: string): string[] {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) { if (/^##\s/.test(line)) break; out.push(line); }
  return out;
}
const bullets = (lines: string[], marker = /^[-*]\s+/) => lines.map(l => l.trim()).filter(l => marker.test(l)).map(l => l.replace(marker, "").trim());
const prose = (lines: string[]) => lines.join("\n").trim();

export function projectTeachingReferences(files: Array<{ path: string; markdown: string }>): TeachingReferences {
  const out: TeachingReferences = { styles: {}, traditions: {}, practice: {}, levels: {}, exemplars: {} };
  for (const { path, markdown } of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const type = front(markdown, "record_type");
    if (type === "exemplar") {
      const ex = { reply: prose(section(markdown, "Good reply")), why: bullets(section(markdown, "Why it fits")), avoid: bullets(section(markdown, "Avoid")) };
      if (!ex.reply) throw new Error(`${path} has no "Good reply"`);
      const style = front(markdown, "style")!, tradition = front(markdown, "tradition")!, practice = front(markdown, "practice")!, level = front(markdown, "explain_level")!;
      // The file name says what the reply demonstrates; the other fields are the defaults it was written under.
      const file = path.split("/").pop()!;
      if (file.startsWith("style-")) out.exemplars[`style:${style}:${level}`] = ex;
      else if (file.startsWith("tradition-")) out.exemplars[`tradition:${tradition}`] = ex;
      else if (file.startsWith("practice-")) out.exemplars[`practice:${practice}`] = ex;
      else throw new Error(`${path}: exemplar file names start with style-, tradition- or practice-`);
      continue;
    }
    const dimension = front(markdown, "ui_dimension"), id = front(markdown, "ui_id"), label = front(markdown, "ui_label");
    if (!dimension || !id || !label) continue;
    if (dimension === "explanation_level") {
      out.levels[id] = { label, rules: bullets(section(markdown, "Rules")), sample: prose(section(markdown, "Same idea at this level")), avoid: bullets(section(markdown, "Avoid")) };
      continue;
    }
    const option = { label, sequence: bullets(section(markdown, "Core sequence"), /^\d+\.\s+/), rules: bullets(section(markdown, "Recommended coaching rules")) };
    if (dimension === "coaching_style") out.styles[id] = option;
    else if (dimension === "learning_tradition") out.traditions[id] = option;
    else if (dimension === "practice_recipe") out.practice[id] = option;
  }
  return out;
}

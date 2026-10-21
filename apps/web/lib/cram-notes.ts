/** Keep source-backed lesson facts while removing its exercises and handoffs. */
export function compactCramNotes(explanation: string): string {
  return explanation
    .replace(/^#{1,6}\s+.*$/gm, "")
    .split(/\n+|(?<=[.!])\s+(?=[A-Z])/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 12 && !line.endsWith("?") &&
      !/^(?:try|practice|check your|ask yourself|now you|let's|remember to|in this lesson)/i.test(line))
    .slice(0, 8)
    .map((line) => `- ${line}`)
    .join("\n");
}

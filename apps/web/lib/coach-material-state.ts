export type CoachMaterialState = "streaming" | "grounded" | "coaching" | "insufficient";

const INSUFFICIENT_MATERIAL_PATTERNS = [
  /I can't answer that from the materials in this Study Room yet\./i,
  /There isn't enough processed material on/i,
  /The material behind that question isn't available anymore/i,
  /Add a study guide topic first/i
];

export function coachMaterialState(args: {
  content: string;
  grounded?: boolean;
  streaming?: boolean;
}): CoachMaterialState {
  if (args.streaming) return "streaming";
  if (args.grounded) return "grounded";
  if (INSUFFICIENT_MATERIAL_PATTERNS.some((pattern) => pattern.test(args.content))) {
    return "insufficient";
  }
  return "coaching";
}

export function coachMaterialLabel(args: {
  content: string;
  grounded?: boolean;
  streaming?: boolean;
}): string {
  const state = coachMaterialState(args);
  if (state === "streaming") return "COACHING…";
  if (state === "grounded") return "GROUNDED IN YOUR MATERIALS";
  if (state === "insufficient") return "NEEDS MORE MATERIAL";
  return "COACHING FROM YOUR MATERIALS";
}

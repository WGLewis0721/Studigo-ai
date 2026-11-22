export type StudigoTouchRegion = "head" | "belly" | "tail" | "outside";

/** Coordinates are fractions of the square, uncropped Rive artboard. */
export function studigoTouchRegion(x: number, y: number): StudigoTouchRegion {
  const inside = (cx: number, cy: number, rx: number, ry: number) =>
    Math.hypot((x - cx) / rx, (y - cy) / ry) <= 1;
  if (inside(0.495, 0.335, 0.205, 0.165)) return "head";
  // The tail runs from the hip up and out to the flame on the viewer's left.
  if (inside(0.27, 0.66, 0.115, 0.19)) return "tail";
  if (inside(0.50, 0.677, 0.174, 0.193)) return "belly";
  return "outside";
}

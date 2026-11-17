import type { Outfit } from "../companion-logic";
import type { MotionFrame } from "./director";
import { MAX_PITCH, MAX_TILT, MAX_YAW, RIG, STRETCH, poseHeadPoint, posePoint } from "./rig";

/* Cosmetic outfits: one drawn layer each, pinned to a point on the rig.
   The anchor is the point inside the layer that sits on the slot, and the pivot it
   turns about. The layer takes the same roll and foreshortening as the part it is
   worn on, so a hat or a pair of goggles stays on the head while he turns. */

export type OutfitSlot = "head" | "eyes" | "neck";

export type OutfitLayer = {
  slot: OutfitSlot;
  src: string;
  /** Drawn size in rig pixels (400 space). */
  w: number;
  h: number;
  /** Fractions of the layer's box, 0..1. */
  anchor: { x: number; y: number };
  /** Rolls with the head's tilt. The neck slot rides the chest, which does not roll. */
  followRoll: boolean;
};

const art = (id: Outfit) => `/mascot/companion/outfits/${id}.svg`;

export const OUTFIT_LAYERS: Record<Outfit, OutfitLayer> = {
  goggles: { slot: "eyes", src: art("goggles"), w: 152, h: 92, anchor: { x: 0.5, y: 0.565 }, followRoll: true },
  explorer: { slot: "head", src: art("explorer"), w: 150, h: 64, anchor: { x: 0.5, y: 0.75 }, followRoll: true },
  visor: { slot: "eyes", src: art("visor"), w: 160, h: 48, anchor: { x: 0.5, y: 0.917 }, followRoll: true },
  reader: { slot: "eyes", src: art("reader"), w: 152, h: 72, anchor: { x: 0.5, y: 0.5 }, followRoll: true },
  beret: { slot: "head", src: art("beret"), w: 162, h: 66, anchor: { x: 0.5, y: 0.667 }, followRoll: true },
  headphones: { slot: "head", src: art("headphones"), w: 210, h: 144, anchor: { x: 0.5, y: 0.25 }, followRoll: true },
  sash: { slot: "neck", src: art("sash"), w: 120, h: 150, anchor: { x: 0.275, y: 0.16 }, followRoll: false }
};

export type OutfitPose = {
  /** Where the anchor goes, in rig pixels. */
  x: number;
  y: number;
  /** Radians, clockwise on screen, the same way the head rolls. */
  rotate: number;
  scaleX: number;
  scaleY: number;
};

/* The chest carries the sash with the body's own sway, and never with the head's turn. */
const CHEST = { head: 0, depth: 0, frillL: 0, frillR: 0, tail: 0, flame: 0, body: 1 };
const unit = (v: number) => Math.max(-1, Math.min(1, v));

function chestPoint(x: number, y: number, frame: MotionFrame) {
  const out = { x: 0, y: 0 };
  posePoint(x, y, CHEST, frame, out);
  return out;
}

/* Between the eyes the rig's dome is deeper than at the eyes, so a point on that midpoint would
   overshoot them on a turn. The eyes slot is therefore taken from the two eyes, which the mesh moves. */
function slotPoint(layer: OutfitLayer, frame: MotionFrame) {
  if (layer.slot === "neck") return chestPoint(RIG.slots.neck.x, RIG.slots.neck.y, frame);
  if (layer.slot === "head") return poseHeadPoint(RIG.slots.head.x, RIG.slots.head.y, frame);
  const left = poseHeadPoint(RIG.eyeL.x, RIG.eyeL.y, frame), right = poseHeadPoint(RIG.eyeR.x, RIG.eyeR.y, frame);
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

/** Where an outfit sits and how it is turned this frame, in rig pixels. */
export function outfitTransform(outfit: Outfit, frame: MotionFrame): OutfitPose {
  const layer = OUTFIT_LAYERS[outfit], at = slotPoint(layer, frame);
  const worn = layer.slot !== "neck";
  // Whole-body stretches apply to every point of him, so a spin or a landing squash reaches the outfit too.
  const wide = (1 + frame.squash * STRETCH.squashWide) * Math.cos(frame.spin);
  const tall = (1 - frame.squash) * (1 + frame.breath * STRETCH.breathTall);
  const near = worn ? 1 + frame.lean * STRETCH.lean : 1;
  return {
    x: at.x,
    y: at.y,
    rotate: layer.followRoll ? frame.headTilt * MAX_TILT : 0,
    scaleX: wide * near * (worn ? Math.cos(unit(frame.headYaw) * MAX_YAW) : 1),
    scaleY: tall * near * (worn ? Math.cos(unit(frame.headPitch) * MAX_PITCH) : 1)
  };
}

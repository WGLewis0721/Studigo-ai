/**
 * The Rive character is on wherever motion mode is on. Kill switches, narrowest first:
 *  NEXT_PUBLIC_STUDIGO_COMPANION=off         no companion at all (checked in useCompanionWindow)
 *  NEXT_PUBLIC_STUDIGO_COMPANION_MOTION=off  the original drawings
 *  NEXT_PUBLIC_STUDIGO_RIVE=off              the WebGL rig instead of Rive
 */
export const studigoRiveEnabled = process.env.NEXT_PUBLIC_STUDIGO_RIVE !== "off"
  && process.env.NEXT_PUBLIC_STUDIGO_COMPANION_MOTION !== "off"
  && process.env.NEXT_PUBLIC_STUDIGO_COMPANION !== "off";

export const studigoVoicePreview = process.env.NODE_ENV === "development"
  && process.env.NEXT_PUBLIC_STUDIGO_COMPANION_VOICE_PREVIEW === "1";

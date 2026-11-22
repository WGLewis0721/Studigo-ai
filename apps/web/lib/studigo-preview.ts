/** Opt in on a preview deployment. Builds stay on the legacy surfaces by default. */
export const studigoRiveEnabled = process.env.NEXT_PUBLIC_STUDIGO_RIVE !== "off"
  && (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_STUDIGO_RIVE === "1");

export const studigoVoicePreview = process.env.NODE_ENV === "development"
  && process.env.NEXT_PUBLIC_STUDIGO_COMPANION_VOICE_PREVIEW === "1";

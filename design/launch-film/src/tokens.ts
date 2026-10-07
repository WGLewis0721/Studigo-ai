// Brand tokens copied from apps/web/app/globals.css (main @ 2e75006). Do not invent new brand colors.
export const C = {
  snow: "#f7f8fb", snow2: "#eef1f6", white: "#ffffff",
  ink: "#141b2d", ink2: "#39435a", muted: "#5d6780", hairline: "rgba(20,27,45,.09)",
  graphite: "#1d2433",
  tangerine: "#ff8a3d", tangerineInk: "#b24a0a", tangerineSoft: "#ffefe2",
  teal: "#1fc3b6", tealInk: "#09756d", tealSoft: "#ddf6f3",
  blueberry: "#3c7cff", blueberryInk: "#1d5bdb", blueberrySoft: "#e7efff",
  dandelion: "#ffd23f", dandelionInk: "#7a5800", dandelionSoft: "#fff6d4",
  kiwi: "#93d93f", kiwiInk: "#3a7010", kiwiSoft: "#eef9df",
  grape: "#7a5af0", berry: "#f0457a", snow3: "#e3e7ef",
};
export const DISPLAY = '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif';
export const SANS = '"Figtree", ui-sans-serif, system-ui, sans-serif';
export const FPS = 30;
export const lift2 = "0 1px 2px rgba(20,27,45,.05), 0 14px 30px -12px rgba(20,27,45,.18)";
export const lift3 = "0 2px 6px rgba(20,27,45,.05), 0 40px 80px -30px rgba(20,27,45,.32)";
// Temporary VO (seconds). Scratch timing; final read replaces this.
export const VO: { s: number; e: number; t: string }[] = [
  { s: 2.2, e: 3.6, t: "Oh. You’re here early." },
  { s: 4.0, e: 5.8, t: "Got notes? Bring them in." },
  { s: 6.5, e: 8.7, t: "Ask me about your stuff." },
  { s: 9.3, e: 12.6, t: "I’ll show you where the answer comes from." },
  { s: 13.4, e: 16.4, t: "Stuck? We’ll work through it." },
  { s: 17.5, e: 18.9, t: "Then you try." },
  { s: 21.5, e: 24.2, t: "See? That’s you getting it." },
  { s: 25.5, e: 26.9, t: "I’m Studigo." },
  { s: 28.3, e: 29.4, t: "Come on." },
];

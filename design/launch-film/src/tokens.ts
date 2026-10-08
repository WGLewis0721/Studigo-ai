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
  { s: 4.0, e: 5.9, t: "Got a test? Hand over the study guide." },
  { s: 6.6, e: 8.7, t: "Whatever your teacher handed out." },
  { s: 9.4, e: 12.5, t: "Ask me something. I’ll show you the page." },
  { s: 13.5, e: 16.2, t: "Stuck? Okay. One step at a time." },
  { s: 17.6, e: 20.4, t: "Your turn. Tell me how sure you are." },
  { s: 21.6, e: 24.2, t: "Nice. You knew that one." },
  { s: 25.3, e: 27.2, t: "I’m Studigo. I’m coming with you." },
  { s: 27.8, e: 28.8, t: "Come on." },
];

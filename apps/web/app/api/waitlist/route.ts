import { waitlistHandlerFromEnv } from "@/lib/waitlist";

// Public beta waitlist → Google Sheets. Server-side env vars only; see docs/WAITLIST_API.md.
export const runtime = "nodejs";
export const maxDuration = 30;

const handler = waitlistHandlerFromEnv(process.env, { product: "Studigo", siteUrl: "https://studigo-ai.vercel.app/" });

export const POST = (request: Request) => handler(request);
export const OPTIONS = (request: Request) => handler(request);

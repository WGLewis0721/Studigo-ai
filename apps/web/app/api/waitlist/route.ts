import { waitlistHandlerFromEnv } from "@/lib/waitlist";

// Public beta waitlist → Google Sheets. Server-side env vars only; see docs/WAITLIST_API.md.
export const runtime = "nodejs";
export const maxDuration = 15;

const handler = waitlistHandlerFromEnv(process.env);

export const POST = (request: Request) => handler(request);
export const OPTIONS = (request: Request) => handler(request);

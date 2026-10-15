import { notFound } from "next/navigation";
import { MissionPreview } from "@/components/phase3/mission-preview";

/** Isolated, synthetic Phase 3 UI. Visible in local dev and on this branch's Vercel preview. Never on production. */
export default function Phase3PreviewPage() {
  const preview = process.env.VERCEL_ENV === "preview";
  if (process.env.NODE_ENV !== "development" && !preview) notFound();
  return <MissionPreview/>;
}

import { notFound } from "next/navigation";
import { MissionPreview } from "@/components/phase3/mission-preview";

/** Isolated, synthetic Phase 3 UI art and interaction preview. Never serves learner data. */
export default function Phase3PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MissionPreview/>;
}

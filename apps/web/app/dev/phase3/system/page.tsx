import { notFound } from "next/navigation";
import { SystemPreview } from "@/components/phase3/system-preview";

export default function Phase3SystemPage() {
  const preview = process.env.VERCEL_ENV === "preview";
  if (process.env.NODE_ENV !== "development" && !preview) notFound();
  return <SystemPreview/>;
}

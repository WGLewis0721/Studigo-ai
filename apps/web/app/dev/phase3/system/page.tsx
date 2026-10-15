import { notFound } from "next/navigation";
import { SystemPreview } from "@/components/phase3/system-preview";

export default function Phase3SystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SystemPreview/>;
}

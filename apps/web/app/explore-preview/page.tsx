import { notFound } from "next/navigation";
import type { Metadata } from "next";
import StudyFixture from "../dev/study/page";

// This route is a clearly labeled showcase of fake, static classroom content.
// It is never a shortcut to a learner-owned room or the Guided Learn API.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore Quest Journal Preview · Studigo",
  robots: { index: false, follow: false }
};

export default async function ExplorePreviewPage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    notFound();
  }
  // Reuse the same synthetic fixture exercised by the existing four-width
  // screenshot suite. No authenticated data or feature-flag override.
  return StudyFixture({
    searchParams: Promise.resolve({ learn: "explore", shell: "1", ui: "phase3" })
  });
}

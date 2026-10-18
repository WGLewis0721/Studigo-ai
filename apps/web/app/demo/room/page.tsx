import type { Metadata } from "next";
import StudyFixture from "../../dev/study/page";
import { PublicDemoBridge } from "@/components/home/public-demo-bridge";

// Public, synthetic demonstration of the REAL RoomWorkspace and ExploreJournal.
// The normal /dev/study and /explore-preview routes remain production-gated.
// No user session, uploaded document, saved progress or provider call is shown.
export const metadata: Metadata = {
  title: "Studigo sample Study Room",
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function PublicRoomDemo({
  searchParams
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const requested = (await searchParams).mode;
  const mode = requested === "learn" || requested === "quiz" || requested === "cards" ? requested : "coach";
  return <>
    <PublicDemoBridge />
    {await StudyFixture({
    publicDemo: true,
    searchParams: Promise.resolve({
      mode: mode === "learn" ? "coach" : mode,
      learn: mode === "learn" ? "explore" : undefined,
      bare: "1",
      ui: "phase3"
    })
  })}
  </>;
}

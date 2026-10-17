import { StudigoMascot } from "@/components/studigo-mascot";

/** One honest, accessible loading state for the room picker and room route.
 * Rendering is not evidence that upload/indexing or lesson work is complete.
 */
export function RoomLoadingState() {
  return (
    <div className="stateScreen" role="status" aria-live="polite" data-tone="tangerine">
      <StudigoMascot state="thinking" size={88} />
      <h2>Opening your Study Room…</h2>
      <span className="loadingBar" aria-hidden="true"><i /></span>
    </div>
  );
}

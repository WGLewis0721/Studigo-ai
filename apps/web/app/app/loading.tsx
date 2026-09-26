import { StudigoMascot } from "@/components/studigo-mascot";

export default function Loading() {
  return (
    <div className="stateScreen" role="status" aria-live="polite" data-tone="tangerine">
      <StudigoMascot state="thinking" size={88} />
      <h2>Opening your Study Room…</h2>
      <span className="loadingBar" aria-hidden="true"><i /></span>
    </div>
  );
}

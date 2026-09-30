import type { ReactNode } from "react";
import { StudigoMascot, type MascotState } from "@/components/studigo-mascot";

/**
 * The one heading every Study Room page uses: mascot and title on the same
 * line, one short supporting sentence underneath, optional action on the right.
 */
export function PageHead({
  title,
  sub,
  state = "welcome",
  action
}: {
  title: string;
  sub?: ReactNode;
  state?: MascotState;
  action?: ReactNode;
}) {
  return (
    <header className="pageHead">
      <StudigoMascot state={state} size={52} />
      <div className="phText">
        <h2 className="phTitle">{title}</h2>
        {sub && <p className="phSub">{sub}</p>}
      </div>
      {action && <div className="phAction">{action}</div>}
    </header>
  );
}

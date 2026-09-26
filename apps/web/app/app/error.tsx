"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StudigoMascot } from "@/components/studigo-mascot";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="stateScreen" role="alert" data-tone="berry">
      <StudigoMascot state="explain" size={88} />
      <h2>That didn&apos;t load.</h2>
      <p>
        Nothing you saved is lost. Try again, or head back to your rooms. If it keeps happening,
        check your connection.
      </p>
      <div className="settingsActions">
        <button className="buttonPrimary" type="button" onClick={() => retry()}>
          Try again <span aria-hidden="true">↻</span>
        </button>
        <Link className="ghostButton" href="/app">
          All rooms
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StudigoMascot } from "@/components/studigo-mascot";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="stateScreen" role="alert" data-tone="berry">
      <StudigoMascot state="explain" size={88} />
      <h2>That didn&apos;t load.</h2>
      <p>
        This page could not finish loading. Try again. If the problem continues, return to
        your Study Rooms and check your connection.
      </p>
      <div className="settingsActions">
        <button className="buttonPrimary" type="button" onClick={() => reset()}>
          Try again <span aria-hidden="true">↻</span>
        </button>
        <Link className="ghostButton" href="/app">
          All rooms
        </Link>
      </div>
    </div>
  );
}

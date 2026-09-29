import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// The multiplication alpha is a game prototype, not part of the learner app.
// It stays reachable in local dev only; deployed builds return 404.
export default function GameLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}

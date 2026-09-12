import { StudigoMascot } from "@/components/studigo-mascot";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="authPage">
      <div className="authCard">
        <Link className="wordmark" href="/" aria-label="Studigo home">
          <StudigoMascot size={40} mark />
          <span>Studigo</span>
        </Link>
        {children}
      </div>
      <aside className="authAside" aria-hidden="true">
        <div className="authAsideInner">
          <p className="authQuote">
            Your study guide, your textbook, your notes — one companion that answers from them and
            shows the receipts.
          </p>
          <div className="authProof">
            <span>
              <i>01</i> Your sources first
            </span>
            <span>
              <i>02</i> Answers with receipts
            </span>
            <span>
              <i>03</i> Weak spots surfaced
            </span>
          </div>
        </div>
      </aside>
    </main>
  );
}

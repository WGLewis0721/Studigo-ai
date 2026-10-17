import { useId, type ReactNode } from "react";

/**
 * Shared Study Room empty-state semantics. Existing .modeEmpty design tokens
 * provide the approved matte reading surface; this component does not imply
 * that any background processing, grading, or mastery has completed.
 */
export function StudyRoomEmptyState({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className="modeEmpty" data-state="empty" aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      <p>{description}</p>
      {children}
    </section>
  );
}

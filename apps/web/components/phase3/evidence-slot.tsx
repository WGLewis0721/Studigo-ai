"use client";

import { adaptPhase3Evidence, type Phase3EvidenceInput } from "@/lib/phase3-evidence-adapter";
import { EvidenceRecovery, EvidenceTicket } from "./ui";

/** Presentational slot. Does not fetch a document or submit an answer. */
export function Phase3EvidenceSlot({
  input,
  onOpen,
  onRetry
}: {
  input: Phase3EvidenceInput;
  onOpen?: () => void;
  onRetry?: () => void;
}) {
  const view = adaptPhase3Evidence(input);
  if (view.kind === "ticket") {
    return <EvidenceTicket eyebrow={view.eyebrow} title={view.title} page={view.page} onClick={() => onOpen?.()} />;
  }
  const openOriginal = view.state === "partial" || view.state === "uncertain" ? onOpen : undefined;
  return (
    <EvidenceRecovery
      state={view.state}
      onOriginal={openOriginal}
      onRetry={openOriginal ? undefined : onRetry}
    />
  );
}

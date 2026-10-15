/**
 * Thin presentation adapter for one authorized Materials citation.
 * It does not fetch a document or record learner progress. Production rooms do not call it
 * unless NEXT_PUBLIC_PHASE3_MATERIALS_EVIDENCE is exactly "1".
 */

export type Phase3EvidenceInput = {
  documentId: string;
  title: string;
  blockKey: string | null;
  pageNumber: number | null;
  pageLabel: string | null;
  revision: number | null;
  currentRevision: number | null;
  present: boolean;
  access: "allowed" | "denied";
  ocr: "ready" | "partial" | "missing" | "uncertain" | "processing";
  excerpt: string | null;
  excerptVerified: boolean;
};

export type Phase3EvidenceTicket = {
  kind: "ticket";
  eyebrow: "FROM YOUR MATERIAL";
  title: string;
  page: string;
  passage: string;
  note: string;
  originalHref: string;
};

export type Phase3EvidenceRecoveryState = "missing" | "partial" | "stale" | "uncertain" | "denied";

export type Phase3EvidenceRecovery = {
  kind: "recovery";
  state: Phase3EvidenceRecoveryState;
  title: string;
  body: string;
  actionLabel: string;
  originalHref: string | null;
};

export type Phase3EvidenceView = Phase3EvidenceTicket | Phase3EvidenceRecovery;

export function phase3MaterialsEvidenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHASE3_MATERIALS_EVIDENCE === "1";
}

function originalFileHref(input: Phase3EvidenceInput): string | null {
  if (!input.documentId) return null;
  const params = new URLSearchParams({ documentId: input.documentId, inline: "1" });
  if (typeof input.pageNumber === "number" && Number.isInteger(input.pageNumber) && input.pageNumber > 0) {
    params.set("page", String(input.pageNumber));
  }
  return `/api/documents/download?${params.toString()}`;
}

function pageLabel(input: Phase3EvidenceInput): string {
  const label = input.pageLabel?.trim();
  if (typeof input.pageNumber === "number" && Number.isInteger(input.pageNumber) && input.pageNumber > 0) {
    return `${label || "Page"} ${input.pageNumber}`;
  }
  return label || "Location unavailable";
}

function recovery(
  state: Phase3EvidenceRecoveryState,
  title: string,
  body: string,
  actionLabel: string,
  originalHref: string | null
): Phase3EvidenceRecovery {
  return { kind: "recovery", state, title, body, actionLabel, originalHref };
}

/** Map an already-authorized citation to a ticket or an honest recovery. Never invents a quotation. */
export function adaptPhase3Evidence(input: Phase3EvidenceInput): Phase3EvidenceView {
  const href = originalFileHref(input);
  if (input.access === "denied") {
    return recovery("denied", "This material cannot be opened.", "Access was not granted for this file.", "Back to materials", null);
  }
  if (!input.present) {
    return recovery("missing", "We can’t show that passage yet.", "This material has no verified source passage.", "Choose material", null);
  }
  const revisionKnown = typeof input.revision === "number" && typeof input.currentRevision === "number";
  if (!revisionKnown || input.revision !== input.currentRevision) {
    return recovery(
      "stale",
      "This source has changed.",
      "The passage is no longer linked to the current material. Refresh the evidence before using it.",
      "Refresh source",
      null
    );
  }
  if (input.ocr === "processing" || input.ocr === "missing") {
    return recovery("missing", "We can’t show that passage yet.", "This material has no verified source passage.", "Choose material", null);
  }
  if (input.ocr === "partial") {
    return recovery(
      "partial",
      "We found only part of the passage.",
      "The source text may be incomplete. Open the original before relying on this explanation.",
      "Open original",
      href
    );
  }
  if (input.ocr === "uncertain") {
    return recovery(
      "uncertain",
      "This text is not verified.",
      "OCR could not confirm the passage. Open the original file and do not treat a quotation as verified.",
      "Open original",
      href
    );
  }
  const excerpt = input.excerpt?.trim() ?? "";
  if (input.ocr !== "ready" || !input.excerptVerified || !excerpt || !input.blockKey || !href) {
    return recovery("missing", "We can’t show that passage yet.", "This material has no verified source passage.", "Choose material", null);
  }
  return {
    kind: "ticket",
    eyebrow: "FROM YOUR MATERIAL",
    title: input.title,
    page: pageLabel(input),
    passage: input.excerpt ?? excerpt,
    note: "This passage is the verified excerpt. The original file stays separate from this Studigo view.",
    originalHref: href ?? ""
  };
}

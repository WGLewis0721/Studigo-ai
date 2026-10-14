import { UNTRUSTED_MATERIAL_RULE, chatModel, client, currentTransport, responseOptions } from "./client";
import type { Response, ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

const OCR_PROMPT = [
  "Transcribe all readable text from this scanned study material, in reading order.",
  "Preserve headings, numbered lists, bullet lists, and table rows as plain text.",
  "Describe a diagram or figure in one short bracketed line only when it carries information the text does not, e.g. [Diagram: water cycle with labelled evaporation and condensation].",
  "Do not summarize, correct, translate, or add anything that is not on the page.",
  "Mark unreadable words as [illegible]; never guess missing words.",
  "If the page has no readable text, reply with exactly: NO_TEXT",
  UNTRUSTED_MATERIAL_RULE
].join(" ");

export const OCR_EMPTY_MARKER = "NO_TEXT";

export class OcrCapabilityError extends Error {
  constructor() { super("The configured AI provider does not support document OCR."); }
}

export type OcrFailureReason = "output_limit" | "content_filter" | "incomplete" | "refusal" | "response_failed" | "request_failed";

/** Contains only a deterministic reason, never provider messages or material. */
export class OcrResponseError extends Error {
  constructor(public readonly reason: OcrFailureReason) {
    const messages: Record<OcrFailureReason, string> = {
      output_limit: "OCR transcription reached its output limit and is incomplete.",
      content_filter: "The configured provider could not transcribe this page.",
      incomplete: "OCR transcription did not complete.",
      refusal: "The configured provider declined to transcribe this page.",
      response_failed: "The configured provider failed to transcribe this page.",
      request_failed: "The OCR provider request failed. Please retry."
    };
    super(messages[reason]);
    this.name = "OcrResponseError";
  }
}

function completedOcrText(response: Response) {
  if (response.error || response.status === "failed") throw new OcrResponseError("response_failed");
  if (response.output.some((item) => item.type === "message"
    && item.content.some((part) => part.type === "refusal"))) {
    throw new OcrResponseError("refusal");
  }
  if (response.status !== "completed" || response.incomplete_details) {
    const reason = response.incomplete_details?.reason;
    throw new OcrResponseError(reason === "max_output_tokens" ? "output_limit"
      : reason === "content_filter" ? "content_filter" : "incomplete");
  }
  return cleanOcrText(response.output_text ?? "");
}

async function requestOcr(body: ResponseCreateParamsNonStreaming, timeoutMs = 60_000) {
  try {
    const response = await client().responses.create(body, {
      signal: AbortSignal.timeout(timeoutMs), maxRetries: 0
    });
    return completedOcrText(response);
  } catch (error) {
    if (error instanceof OcrResponseError) throw error;
    throw new OcrResponseError("request_failed");
  }
}

function assertOcrCapability() {
  if (currentTransport() === "ollama") throw new OcrCapabilityError();
}

/**
 * OCR for pages with no usable text layer. A scanned page is handed to the
 * vision model as its own small PDF so the transcription stays tied to one
 * citable page number.
 */
export async function ocrPagePdf(args: {
  pdf: Uint8Array;
  filename: string;
  timeoutMs?: number;
}): Promise<string> {
  assertOcrCapability();
  return requestOcr({
    model: chatModel(),
    ...responseOptions(),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: OCR_PROMPT },
          {
            type: "input_file",
            filename: args.filename.endsWith(".pdf") ? args.filename : `${args.filename}.pdf`,
            file_data: `data:application/pdf;base64,${Buffer.from(args.pdf).toString("base64")}`
          }
        ]
      }
    ]
  }, args.timeoutMs);
}

export async function ocrImage(args: {
  bytes: Uint8Array;
  mimeType: string;
  timeoutMs?: number;
}): Promise<string> {
  assertOcrCapability();
  return requestOcr({
    model: chatModel(),
    ...responseOptions(),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: OCR_PROMPT },
          {
            type: "input_image",
            detail: "high",
            image_url: `data:${args.mimeType};base64,${Buffer.from(args.bytes).toString("base64")}`
          }
        ]
      }
    ]
  }, args.timeoutMs);
}

function cleanOcrText(text: string) {
  const trimmed = text.trim();
  return trimmed === OCR_EMPTY_MARKER ? "" : trimmed;
}

import { UNTRUSTED_MATERIAL_RULE, chatModel, client, responseOptions } from "./client";
import { debitResponseWork, providerAbortSignal, trackProviderCall } from "./provider-budget";


const OCR_PROMPT = [
  "Transcribe all readable text from this scanned study material, in reading order.",
  "Preserve headings, numbered lists, bullet lists, and table rows as plain text.",
  "Describe a diagram or figure in one short bracketed line only when it carries information the text does not, e.g. [Diagram: water cycle with labelled evaporation and condensation].",
  "Do not summarize, correct, translate, or add anything that is not on the page.",
  "If the page has no readable text, reply with exactly: NO_TEXT",
  UNTRUSTED_MATERIAL_RULE
].join(" ");

export const OCR_EMPTY_MARKER = "NO_TEXT";

/**
 * OCR for pages with no usable text layer. A scanned page is handed to the
 * vision model as its own small PDF so the transcription stays tied to one
 * citable page number.
 */
export async function ocrPagePdf(args: {
  pdf: Uint8Array;
  filename: string;
}): Promise<string> {
  const fileData = `data:application/pdf;base64,${Buffer.from(args.pdf).toString("base64")}`;
  debitResponseWork({ model: chatModel(), max_output_tokens: responseOptions().max_output_tokens, input: [OCR_PROMPT, fileData] });
  const response = await trackProviderCall(() => client().responses.create({
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
            file_data: fileData
          }
        ]
      }
    ]
  }, { signal: providerAbortSignal() }));

  return cleanOcrText(response.output_text ?? "");
}

export async function ocrImage(args: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  const fileData = `data:${args.mimeType};base64,${Buffer.from(args.bytes).toString("base64")}`;
  debitResponseWork({ model: chatModel(), max_output_tokens: responseOptions().max_output_tokens, input: [OCR_PROMPT, fileData] });
  const response = await trackProviderCall(() => client().responses.create({
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
            image_url: fileData
          }
        ]
      }
    ]
  }, { signal: providerAbortSignal() }));

  return cleanOcrText(response.output_text ?? "");
}

function cleanOcrText(text: string) {
  const trimmed = text.trim();
  return trimmed === OCR_EMPTY_MARKER ? "" : trimmed;
}



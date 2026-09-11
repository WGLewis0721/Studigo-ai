import {
  embedTexts,
  extractTopicMap,
  ocrImage,
  ocrPagePdf,
  type RetrievedChunk
} from "@studigo/ai";
import {
  chunkPages,
  extractDocument,
  extractSinglePagePdf,
  isImageMimeType,
  pagesNeedingOcr,
  type ExtractedPage,
  type ExtractionResult
} from "@studigo/documents";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

/** A scan-heavy document can otherwise spend an unbounded budget on OCR. */
const MAX_OCR_PAGES = 40;
const MAX_CHUNKS_PER_DOCUMENT = 4000;
const MAX_ATTEMPTS = 3;

export type IngestResult = {
  documentId: string;
  status: "ready" | "failed" | "skipped";
  chunkCount?: number;
  ocrPageCount?: number;
  topicsCreated?: number;
  error?: string;
};

/**
 * Runs one document from stored original to retrievable chunks.
 *
 * The claim update is conditional on the document still being in a startable
 * state, so a double-click or a retry racing the first run cannot ingest the
 * same file twice.
 */
export async function processDocument(args: {
  documentId: string;
  userId: string;
}): Promise<IngestResult> {
  const supabase = createServiceSupabaseClient();

  const { data: document, error: loadError } = await supabase
    .from("documents")
    .select("id, room_id, owner_id, name, mime_type, storage_path, source_type, status, attempts")
    .eq("id", args.documentId)
    .eq("owner_id", args.userId)
    .maybeSingle();

  if (loadError || !document) {
    return { documentId: args.documentId, status: "failed", error: "Document not found" };
  }

  const { data: claimed } = await supabase
    .from("documents")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempts: (document.attempts ?? 0) + 1,
      error_message: null
    })
    .eq("id", document.id)
    .in("status", ["uploaded", "queued", "failed"])
    .select("id")
    .maybeSingle();

  // Another run already owns this document.
  if (!claimed) return { documentId: document.id, status: "skipped" };

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("study-materials")
      .download(document.storage_path);

    if (downloadError || !file) {
      throw new Error(`Could not read the stored file: ${downloadError?.message ?? "missing"}`);
    }

    const buffer = await file.arrayBuffer();
    const extraction = await extractDocument({ mimeType: document.mime_type, buffer });
    const withOcr = await applyOcr({
      extraction,
      buffer,
      mimeType: document.mime_type,
      filename: document.name
    });

    const chunks = chunkPages(withOcr.pages, {
      documentName: document.name,
      sourceType: document.source_type,
      pageLabel: withOcr.pageLabel
    }).slice(0, MAX_CHUNKS_PER_DOCUMENT);

    if (!chunks.length) {
      throw new Error(
        "No readable text could be extracted. If this is a scan or a photo, try a clearer copy."
      );
    }

    const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

    // Re-ingestion replaces the previous pass rather than layering on top of it.
    await supabase.from("document_chunks").delete().eq("document_id", document.id);

    for (let start = 0; start < chunks.length; start += 200) {
      const batch = chunks.slice(start, start + 200).map((chunk, offset) => ({
        document_id: document.id,
        room_id: document.room_id,
        owner_id: document.owner_id,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
        page_label: withOcr.pageLabel,
        content: chunk.content,
        token_count: chunk.tokenCount,
        metadata: chunk.metadata,
        embedding: embeddings[start + offset] as unknown as string
      }));

      const { error: insertError } = await supabase.from("document_chunks").insert(batch);
      if (insertError) throw new Error(`Storing chunks failed: ${insertError.message}`);
    }

    await supabase
      .from("documents")
      .update({
        status: "ready",
        page_count: withOcr.pageCount,
        page_label: withOcr.pageLabel,
        ocr_page_count: withOcr.ocrPageCount,
        chunk_count: chunks.length,
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .eq("id", document.id);

    let topicsCreated = 0;
    if (document.source_type === "study_guide" || document.source_type === "teacher_material") {
      topicsCreated = await buildTopicMap({
        roomId: document.room_id,
        ownerId: document.owner_id,
        documentId: document.id,
        documentName: document.name,
        isTeacherStudyGuide: document.source_type === "study_guide",
        pages: withOcr.pages
      });
    }

    return {
      documentId: document.id,
      status: "ready",
      chunkCount: chunks.length,
      ocrPageCount: withOcr.ocrPageCount,
      topicsCreated
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", document.id);

    return { documentId: document.id, status: "failed", error: message };
  }
}

export function canRetry(document: { status: string; attempts?: number | null }) {
  return document.status === "failed" && (document.attempts ?? 0) < MAX_ATTEMPTS;
}

/**
 * Fills in pages that arrived without a usable text layer. A scanned page is
 * OCR'd on its own so its transcription keeps its original page number, which
 * is what a citation has to point at.
 */
async function applyOcr(args: {
  extraction: ExtractionResult;
  buffer: ArrayBuffer;
  mimeType: string;
  filename: string;
}): Promise<ExtractionResult> {
  if (isImageMimeType(args.mimeType)) {
    const text = await ocrImage({
      bytes: new Uint8Array(args.buffer),
      mimeType: args.mimeType
    });
    return {
      ...args.extraction,
      pages: [{ pageNumber: 1, text, ocr: true }],
      ocrPageCount: text ? 1 : 0
    };
  }

  if (args.mimeType !== "application/pdf") return args.extraction;

  const targets = pagesNeedingOcr(args.extraction).slice(0, MAX_OCR_PAGES);
  if (!targets.length) return args.extraction;

  const byPage = new Map<number, ExtractedPage>(
    args.extraction.pages.map((page) => [page.pageNumber, page])
  );
  let ocrPageCount = 0;

  for (const pageNumber of targets) {
    try {
      const pagePdf = await extractSinglePagePdf(args.buffer, pageNumber);
      const text = await ocrPagePdf({ pdf: pagePdf, filename: `${args.filename}-p${pageNumber}` });
      if (!text) continue;

      const existing = byPage.get(pageNumber);
      byPage.set(pageNumber, {
        pageNumber,
        // Keep whatever thin text layer existed; OCR supplements it.
        text: [existing?.text, text].filter(Boolean).join("\n").trim(),
        ocr: true
      });
      ocrPageCount += 1;
    } catch {
      // A page that will not OCR is left as-is; the rest of the document is
      // still worth having.
    }
  }

  return {
    ...args.extraction,
    pages: [...byPage.values()].sort((a, b) => a.pageNumber - b.pageNumber),
    ocrPageCount
  };
}

/**
 * Study-guide intelligence: read what the teacher says is testable, then link
 * each topic back to the passages in this room that support it.
 */
export async function buildTopicMap(args: {
  roomId: string;
  ownerId: string;
  documentId: string;
  documentName: string;
  isTeacherStudyGuide: boolean;
  pages: ExtractedPage[];
}): Promise<number> {
  const supabase = createServiceSupabaseClient();
  const materialText = args.pages.map((page) => page.text).join("\n\n").trim();
  if (materialText.length < 200) return 0;

  const topics = await extractTopicMap({
    materialText,
    sourceLabel: args.documentName,
    isTeacherStudyGuide: args.isTeacherStudyGuide
  });
  if (!topics.length) return 0;

  const { data: existing } = await supabase
    .from("topics")
    .select("id, title")
    .eq("room_id", args.roomId);

  const seen = new Map<string, string>(
    (existing ?? []).map((topic) => [normalizeTitle(topic.title as string), topic.id as string])
  );

  const evidence = await findTopicEvidence({
    roomId: args.roomId,
    ownerId: args.ownerId,
    topics: topics.map((topic) => `${topic.title}. ${topic.objective}`)
  });

  let created = 0;
  const baseIndex = seen.size;

  for (const [index, topic] of topics.entries()) {
    const key = normalizeTitle(topic.title);
    const payload = {
      room_id: args.roomId,
      owner_id: args.ownerId,
      title: topic.title,
      objective: topic.objective,
      key_terms: topic.keyTerms,
      priority: topic.priority,
      origin: args.isTeacherStudyGuide ? "study_guide" : "teacher_material",
      source_document_ids: [args.documentId],
      evidence: evidence[index] ?? []
    };

    const existingId = seen.get(key);
    if (existingId) {
      // Re-uploading a revised guide refreshes the map without resetting
      // mastery the learner already earned.
      await supabase
        .from("topics")
        .update({
          objective: payload.objective,
          key_terms: payload.key_terms,
          priority: payload.priority,
          evidence: payload.evidence
        })
        .eq("id", existingId);
      continue;
    }

    const { error } = await supabase
      .from("topics")
      .insert({ ...payload, order_index: baseIndex + index });

    if (!error) {
      created += 1;
      seen.set(key, "inserted");
    }
  }

  return created;
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Points each topic at the passages that actually support it. */
async function findTopicEvidence(args: {
  roomId: string;
  ownerId: string;
  topics: string[];
}): Promise<Array<Array<{ documentId: string; documentName: string; pageNumber: number | null }>>> {
  const supabase = createServiceSupabaseClient();
  const embeddings = await embedTexts(args.topics);

  return Promise.all(
    embeddings.map(async (embedding) => {
      const { data } = await supabase.rpc("match_study_chunks", {
        p_room_id: args.roomId,
        p_query_embedding: embedding as unknown as string,
        p_match_count: 3,
        p_min_similarity: 0.3,
        p_owner_id: args.ownerId
      });

      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        documentId: String(row.document_id),
        documentName: String(row.document_name),
        pageNumber: row.page_number == null ? null : Number(row.page_number)
      }));
    })
  );
}

export function toRetrievedChunks(rows: Array<Record<string, unknown>>): RetrievedChunk[] {
  return rows.map((row) => ({
    id: String(row.chunk_id),
    documentId: String(row.document_id),
    documentName: String(row.document_name),
    content: String(row.content),
    similarity: Number(row.similarity),
    sourceType: row.source_type ? String(row.source_type) : null,
    pageNumber: row.page_number == null ? null : Number(row.page_number),
    pageLabel: row.page_label ? String(row.page_label) : "page",
    priority: row.priority == null ? null : Number(row.priority)
  }));
}

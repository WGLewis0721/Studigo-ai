import { SOURCE_TYPE_LABELS } from "@studigo/documents";
import { buildStudyGuidePdf } from "@/lib/study-guide-pdf";
import { MATERIAL_NOTES } from "@/lib/fixture-materials";

export const runtime = "nodejs";

function sourceName(source: string): string {
  return source.replace(/^Study guide\s*·\s*/i, "") || "Fixture study guide";
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const topics = Object.entries(MATERIAL_NOTES).map(([title, note]) => {
    const fromStudyGuide = /^Study guide\s*·/i.test(note.source);
    return {
      title,
      objective: note.summary,
      keyTerms: [],
      sourceNotes: [
        {
          text: `${note.summary} ${note.example}`,
          documentName: sourceName(note.source),
          pageNumber: null,
          pageLabel: "page",
          sourceLabel: fromStudyGuide ? SOURCE_TYPE_LABELS.study_guide : null,
          priority: fromStudyGuide ? 100 : null
        }
      ]
    };
  });

  const pdf = buildStudyGuidePdf({
    title: "Fifth Grade Science · Codespaces Preview",
    subject: "Life, physical & earth science",
    courseName: "Synthetic fixture",
    testDate: null,
    topics
  });

  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Fifth-Grade-Science-Study-Guide.pdf"',
      "Cache-Control": "no-store"
    }
  });
}

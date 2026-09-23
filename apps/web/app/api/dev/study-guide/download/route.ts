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

  const topics = Object.entries(MATERIAL_NOTES).map(([title, note]) => ({
    title,
    objective: note.summary,
    keyTerms: [],
    sourceNotes: [
      {
        text: `${note.summary} ${note.example}`,
        documentName: sourceName(note.source),
        pageNumber: null,
        pageLabel: "page"
      }
    ]
  }));

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

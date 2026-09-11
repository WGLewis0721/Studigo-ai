import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Hands back a short-lived signed URL for the learner's own original file.
 * `?inline=1` opens it in the browser (used by citation "open the source"
 * links); otherwise it downloads under its original name.
 */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId")?.trim();
  const inline = url.searchParams.get("inline") === "1";
  const page = Number(url.searchParams.get("page") || 0);

  if (!documentId) {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, name, mime_type, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("study-materials")
    .createSignedUrl(document.storage_path as string, 120, {
      download: inline ? false : (document.name as string)
    });

  if (signedError || !signed?.signedUrl) {
    return Response.json({ error: "Unable to create a link for that file" }, { status: 500 });
  }

  // PDF viewers jump straight to the cited page.
  const target =
    inline && page > 0 && document.mime_type === "application/pdf"
      ? `${signed.signedUrl}#page=${page}`
      : signed.signedUrl;

  return Response.redirect(target, 302);
}

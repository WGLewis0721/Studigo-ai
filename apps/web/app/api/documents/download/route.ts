import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId")?.trim();
  if (!documentId) {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, name, storage_path")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("study-materials")
    .createSignedUrl(document.storage_path, 60, { download: document.name });

  if (signedError || !signed?.signedUrl) {
    return Response.json({ error: "Unable to create download link" }, { status: 500 });
  }

  return Response.redirect(signed.signedUrl, 302);
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

const binaries = ["rive.wasm", "rive_fallback.wasm"] as const;

export function generateStaticParams() {
  return binaries.map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const binary = binaries.find((name) => name === file);
  if (!binary) return new Response(null, { status: 404 });
  const bytes = await readFile(join(process.cwd(), "node_modules", "@rive-app", "webgl2", binary));
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/wasm", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

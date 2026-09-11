export async function GET() {
  return Response.json({
    ok: true,
    service: "studigo-web",
    timestamp: new Date().toISOString()
  });
}

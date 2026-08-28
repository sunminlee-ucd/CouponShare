export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      release: "hydration-fix-beta8-20260828",
      vinext: "1.0.0-beta.8",
      rscPlugin: "0.5.34",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

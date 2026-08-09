import { getSqlClient } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ connected: false, reason: "not_configured" }, { status: 503 });
  }

  try {
    const sql = getSqlClient();
    await sql`select 1`;
    return Response.json({ connected: true, provider: "postgresql" });
  } catch (error) {
    console.error("Database health check failed", error);
    return Response.json({ connected: false, reason: "connection_failed" }, { status: 503 });
  }
}

import { withSqlReconnect } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ connected: false, reason: "not_configured" }, { status: 503 });
  }

  try {
    await withSqlReconnect(async (sql) => {
      await sql`select 1`;
    });
    return Response.json({ connected: true, provider: "postgresql" });
  } catch (error) {
    console.error("Database health check failed after reconnect attempts", error);
    return Response.json({ connected: false, reason: "connection_failed" }, { status: 503 });
  }
}

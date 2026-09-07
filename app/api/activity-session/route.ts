import { withSqlReconnect } from "@/db";
import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedActions = new Set(["start", "heartbeat", "page_view", "end"]);

function validPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && value.length <= 240;
}

function missingActivityTable(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42P01");
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const path = body.path;
  if (!allowedActions.has(action) || !uuidPattern.test(sessionId) || !validPath(path)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ ok: true, tracked: false }, { headers: { "cache-control": "private, no-store" } });
  if (profile.isBlocked) return Response.json({ error: "blocked" }, { status: 403 });

  try {
    const updated = await withSqlReconnect(async (sql) => {
      let row: { id: string } | undefined;

      if (action === "start") {
        [row] = await sql<{ id: string }[]>`
          insert into app_user_sessions (id, profile_id, started_at, last_seen_at, ended_at, page_views, last_path)
          values (${sessionId}::uuid, ${profile.id}::uuid, now(), now(), null, 1, ${path})
          on conflict (id) do update
            set last_seen_at = now(), ended_at = null, last_path = excluded.last_path
            where app_user_sessions.profile_id = excluded.profile_id
          returning id::text
        `;
      } else if (action === "page_view") {
        [row] = await sql<{ id: string }[]>`
          update app_user_sessions
          set page_views = page_views + 1, last_seen_at = now(), ended_at = null, last_path = ${path}
          where id = ${sessionId}::uuid and profile_id = ${profile.id}::uuid
          returning id::text
        `;
      } else if (action === "heartbeat") {
        [row] = await sql<{ id: string }[]>`
          update app_user_sessions
          set last_seen_at = now(), ended_at = null, last_path = ${path}
          where id = ${sessionId}::uuid and profile_id = ${profile.id}::uuid
          returning id::text
        `;
      } else {
        [row] = await sql<{ id: string }[]>`
          update app_user_sessions
          set last_seen_at = now(), ended_at = now(), last_path = ${path}
          where id = ${sessionId}::uuid and profile_id = ${profile.id}::uuid
          returning id::text
        `;
      }

      return row;
    });

    if (!updated) return Response.json({ error: "session_not_found" }, { status: 409 });

    return Response.json({ ok: true, tracked: true }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (missingActivityTable(error)) {
      return Response.json(
        { ok: true, tracked: false, reason: "activity_schema_pending" },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    console.error("Activity session update failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

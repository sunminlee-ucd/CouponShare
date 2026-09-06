import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

type AuthIdentity = { auth_user_id: string; email: string | null; provider: string | null };

type UserRow = {
  profile_id: string;
  auth_user_id: string | null;
  fallback_label: string;
  is_online: boolean;
  today_sessions: number;
  total_sessions: number;
  today_page_views: number;
  total_page_views: number;
  total_minutes: number;
  last_entered_at: string | null;
  last_exit_at: string | null;
};

type RecentRow = {
  session_id: string;
  profile_id: string;
  auth_user_id: string | null;
  fallback_label: string;
  status: "online" | "ended" | "stale";
  started_at: string;
  ended_at: string | null;
  last_seen_at: string;
  page_views: number;
  duration_minutes: number;
  last_path: string;
};

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(token, password)) {
    return Response.json({ error: "admin_auth_required" }, { status: 401 });
  }

  try {
    const sql = getSqlClient();
    const [summaryRows, userRows, recentRows] = await Promise.all([
      sql<Array<{
        online_now: number;
        sessions_today: number;
        unique_users_today: number;
        total_sessions: number;
        tracked_users: number;
        page_views_today: number;
      }>>`
        select
          count(distinct profile_id) filter (
            where ended_at is null and last_seen_at >= now() - interval '2 minutes'
          )::int as online_now,
          count(*) filter (
            where (started_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
          )::int as sessions_today,
          count(distinct profile_id) filter (
            where (started_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
          )::int as unique_users_today,
          count(*)::int as total_sessions,
          count(distinct profile_id)::int as tracked_users,
          coalesce(sum(page_views) filter (
            where (started_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
          ), 0)::int as page_views_today
        from app_user_sessions
      `,
      sql<UserRow[]>`
        select
          p.id::text as profile_id,
          p.auth_user_id::text as auth_user_id,
          '사용자 · ' || upper(substr(md5(p.id::text), 1, 5)) as fallback_label,
          bool_or(s.ended_at is null and s.last_seen_at >= now() - interval '2 minutes') as is_online,
          count(*) filter (
            where (s.started_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
          )::int as today_sessions,
          count(*)::int as total_sessions,
          coalesce(sum(s.page_views) filter (
            where (s.started_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
          ), 0)::int as today_page_views,
          coalesce(sum(s.page_views), 0)::int as total_page_views,
          greatest(0, round(sum(extract(epoch from (coalesce(s.ended_at, s.last_seen_at) - s.started_at))) / 60.0))::int as total_minutes,
          to_char(max(s.started_at) at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI') as last_entered_at,
          to_char(max(coalesce(s.ended_at, s.last_seen_at)) at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI') as last_exit_at
        from profiles p
        join app_user_sessions s on s.profile_id = p.id
        group by p.id, p.auth_user_id
        order by bool_or(s.ended_at is null and s.last_seen_at >= now() - interval '2 minutes') desc, max(s.last_seen_at) desc
        limit 250
      `,
      sql<RecentRow[]>`
        select
          s.id::text as session_id,
          p.id::text as profile_id,
          p.auth_user_id::text as auth_user_id,
          '사용자 · ' || upper(substr(md5(p.id::text), 1, 5)) as fallback_label,
          case
            when s.ended_at is not null then 'ended'
            when s.last_seen_at >= now() - interval '2 minutes' then 'online'
            else 'stale'
          end as status,
          to_char(s.started_at at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI') as started_at,
          case when s.ended_at is null then null else to_char(s.ended_at at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI') end as ended_at,
          to_char(s.last_seen_at at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI') as last_seen_at,
          s.page_views::int,
          greatest(0, round(extract(epoch from (coalesce(s.ended_at, s.last_seen_at) - s.started_at)) / 60.0))::int as duration_minutes,
          s.last_path
        from app_user_sessions s
        join profiles p on p.id = s.profile_id
        order by s.started_at desc
        limit 100
      `,
    ]);

    let identities: AuthIdentity[] = [];
    try {
      identities = await sql<AuthIdentity[]>`
        select
          u.id::text as auth_user_id,
          u.email,
          coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider
        from auth.users u
        where u.id in (
          select distinct p.auth_user_id
          from profiles p
          join app_user_sessions s on s.profile_id = p.id
          where p.auth_user_id is not null
        )
      `;
    } catch (error) {
      console.warn("Admin activity auth identity lookup unavailable; using profile labels", error);
    }

    const identityById = new Map(identities.map((identity) => [identity.auth_user_id, identity]));
    const enrich = <T extends { auth_user_id: string | null; fallback_label: string }>(row: T) => {
      const identity = row.auth_user_id ? identityById.get(row.auth_user_id) : undefined;
      return {
        ...row,
        user_label: identity?.email || row.fallback_label,
        provider: identity?.provider ?? null,
      };
    };

    return Response.json(
      {
        summary: summaryRows[0] ?? {
          online_now: 0,
          sessions_today: 0,
          unique_users_today: 0,
          total_sessions: 0,
          tracked_users: 0,
          page_views_today: 0,
        },
        users: userRows.map(enrich),
        recent: recentRows.map(enrich),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Admin user activity analytics failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

import { getSqlClient } from "@/db";
import { readCookie, USER_AUTH_COOKIE_NAME, verifyUserAuthToken } from "@/app/auth/session";

export const runtime = "nodejs";

const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_LENGTH = 900_000;

type ProfileRow = { id: string; is_blocked: boolean };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function authenticatedProfile(request: Request) {
  const token = readCookie(request.headers.get("cookie"), USER_AUTH_COOKIE_NAME);
  const session = await verifyUserAuthToken(token);
  if (!session) return null;
  const sql = getSqlClient();
  const [profile] = await sql<ProfileRow[]>`
    select id::text, is_blocked
    from profiles
    where id = ${session.profileId}::uuid
      and auth_user_id = ${session.authUserId}::uuid
    limit 1
  `;
  return profile ?? null;
}

export async function GET(request: Request) {
  const profile = await authenticatedProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.is_blocked) return Response.json({ error: "blocked" }, { status: 403 });

  const sql = getSqlClient();
  const pending = await sql<Array<{
    voucher_id: string;
    voucher_label: string;
    membership_required: boolean;
    first_viewed_at: string;
  }>>`
    select
      v.id::text as voucher_id,
      case v.voucher_type
        when '5off25' then '€5 OFF €25'
        when '10off40' then '€10 OFF €40'
        else '€10 OFF €50'
      end as voucher_label,
      v.membership_required,
      to_char(min(a.occurred_at) at time zone 'Europe/Dublin', 'YYYY-MM-DD HH24:MI:SS') as first_viewed_at
    from dunnes_vouchers v
    join dunnes_voucher_activity a
      on a.voucher_id = v.id
      and a.profile_id = v.reserved_by
      and a.event_type = 'viewed'
    where v.status = 'reserved'
      and v.reserved_by = ${profile.id}::uuid
      and v.reserved_at is null
    group by v.id, v.voucher_type, v.membership_required
    having min(a.occurred_at) <= now() - interval '30 minutes'
    order by min(a.occurred_at) asc
  `;

  return Response.json({ pending }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const profile = await authenticatedProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.is_blocked) return Response.json({ error: "blocked" }, { status: 403 });

  let body: { imageData?: unknown };
  try {
    body = await request.json() as { imageData?: unknown };
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (typeof body.imageData !== "string" || body.imageData.length > MAX_IMAGE_LENGTH || !imagePattern.test(body.imageData)) {
    return Response.json({ error: "invalid_image" }, { status: 400 });
  }

  const sql = getSqlClient();
  const [locked] = await sql<{ id: string }[]>`
    update dunnes_vouchers
    set reserved_at = null, updated_at = now()
    where reserved_by = ${profile.id}::uuid
      and status = 'reserved'
      and (
        md5(image_data) = md5(${body.imageData})
        or (membership_image_data is not null and md5(membership_image_data) = md5(${body.imageData}))
      )
    returning id::text
  `;

  if (!locked) return Response.json({ error: "reservation_not_found" }, { status: 409 });
  return Response.json({ locked: true, voucherId: locked.id }, { headers: { "cache-control": "private, no-store" } });
}

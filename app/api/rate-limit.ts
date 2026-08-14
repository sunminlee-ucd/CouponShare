import { getSqlClient } from "@/db";

const globalForRateLimit = globalThis as typeof globalThis & { couponShareRateLimitSchema?: Promise<void> };

async function createSchema() {
  const sql = getSqlClient();
  await sql`
    create table if not exists api_rate_limits (
      profile_id uuid not null references profiles(id) on delete cascade,
      action text not null,
      window_start timestamptz not null,
      request_count integer not null default 0 check (request_count >= 0),
      updated_at timestamptz not null default now(),
      primary key (profile_id, action, window_start)
    )
  `;
  await sql`alter table api_rate_limits enable row level security`;
}

async function ensureSchema() {
  globalForRateLimit.couponShareRateLimitSchema ??= createSchema();
  return globalForRateLimit.couponShareRateLimitSchema;
}

export async function consumeRateLimit(profileId: string, action: string, limit: number, windowMinutes: number) {
  await ensureSchema();
  const sql = getSqlClient();
  const seconds = Math.max(60, Math.floor(windowMinutes * 60));
  const [usage] = await sql<{ request_count: number }[]>`
    insert into api_rate_limits (profile_id, action, window_start, request_count, updated_at)
    values (${profileId}::uuid, ${action}, to_timestamp(floor(extract(epoch from now()) / ${seconds}) * ${seconds}), 1, now())
    on conflict (profile_id, action, window_start) do update
      set request_count = api_rate_limits.request_count + 1, updated_at = now()
      where api_rate_limits.request_count < ${limit}
    returning request_count
  `;
  return usage?.request_count ?? null;
}

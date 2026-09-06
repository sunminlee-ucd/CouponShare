import { getSqlClient } from "@/db";

export async function consumeRateLimit(profileId: string, action: string, limit: number, windowMinutes: number) {
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

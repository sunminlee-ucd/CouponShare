import { getSqlClient } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sql = getSqlClient();
    const [summary, vouchers] = await Promise.all([
      sql<{ used_today: number }[]>`
        select count(*)::int as used_today
        from dunnes_vouchers
        where status = 'used'
          and review_status = 'approved'
          and used_at is not null
          and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
      `,
      sql<Array<{
        voucher_id: string;
        voucher_type: "5off25" | "10off40" | "10off50";
        membership_required: boolean;
        used_at: string;
      }>>`
        select
          id::text as voucher_id,
          voucher_type,
          membership_required,
          to_char(used_at at time zone 'Europe/Dublin', 'HH24:MI') as used_at
        from dunnes_vouchers
        where status = 'used'
          and review_status = 'approved'
          and used_at is not null
          and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
        order by used_at desc
        limit 12
      `,
    ]);

    return Response.json(
      { usedToday: Number(summary[0]?.used_today ?? 0), vouchers },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Today used Dunnes activity read failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

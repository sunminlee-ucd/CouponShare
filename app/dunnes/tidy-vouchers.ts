import { getSqlClient } from "@/db";

export async function tidyDunnesVouchers() {
  const sql = getSqlClient();

  await sql.begin(async (transaction) => {
    await transaction`
      update dunnes_vouchers
      set status = 'expired',
          reserved_by = null,
          reserved_at = null,
          updated_at = now()
      where status in ('available', 'reserved')
        and expires_on < (now() at time zone 'Europe/Dublin')::date
    `;

    await transaction`
      update dunnes_vouchers
      set status = 'available',
          reserved_by = null,
          reserved_at = null,
          updated_at = now()
      where status = 'reserved'
        and reserved_by is not null
        and expires_on >= (now() at time zone 'Europe/Dublin')::date
        and (
          reserved_at <= now() - interval '30 minutes'
          or (
            reserved_at is null
            and updated_at <= now() - interval '30 minutes'
          )
        )
    `;
  });
}

import { getSqlClient } from "@/db";

type ReviewRequest = {
  voucherId: string;
  ownerId: string;
};

export async function requestUnusedReviewByImage(profileId: string, imageData: string): Promise<ReviewRequest | null> {
  const sql = getSqlClient();
  const [voucher] = await sql<{ id: string; owner_id: string }[]>`
    update dunnes_vouchers
    set reserved_by = null,
        reserved_at = null,
        used_at = null,
        updated_at = now()
    where image_data = ${imageData}
      and reserved_by = ${profileId}::uuid
      and status = 'reserved'
    returning id::text, owner_id::text
  `;
  return voucher ? { voucherId: voucher.id, ownerId: voucher.owner_id } : null;
}

export async function requestUnusedReviewByVoucherId(profileId: string, voucherId: string): Promise<ReviewRequest | null> {
  const sql = getSqlClient();
  const [voucher] = await sql<{ id: string; owner_id: string }[]>`
    update dunnes_vouchers
    set reserved_by = null,
        reserved_at = null,
        used_at = null,
        updated_at = now()
    where id = ${voucherId}::uuid
      and reserved_by = ${profileId}::uuid
      and status = 'reserved'
    returning id::text, owner_id::text
  `;
  return voucher ? { voucherId: voucher.id, ownerId: voucher.owner_id } : null;
}

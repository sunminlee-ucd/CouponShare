import { getSqlClient } from "@/db";

type ReviewRequest = {
  voucherId: string;
  ownerId: string;
};

async function createReviewByImage(profileId: string, imageData: string): Promise<ReviewRequest | null> {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const [voucher] = await transaction<{ id: string; owner_id: string }[]>`
      select id::text, owner_id::text
      from dunnes_vouchers
      where image_data = ${imageData}
        and reserved_by = ${profileId}::uuid
        and status = 'reserved'
      for update
    `;
    if (!voucher) return null;

    await transaction`
      update dunnes_vouchers
      set reserved_by = null,
          reserved_at = null,
          used_at = null,
          updated_at = now()
      where id = ${voucher.id}::uuid
        and reserved_by = ${profileId}::uuid
        and status = 'reserved'
    `;

    await transaction`
      insert into user_notifications (
        recipient_profile_id,
        actor_profile_id,
        voucher_id,
        type,
        status
      )
      values (
        ${voucher.owner_id}::uuid,
        ${profileId}::uuid,
        ${voucher.id}::uuid,
        'voucher_unused_confirmation',
        'unread'
      )
    `;

    return { voucherId: voucher.id, ownerId: voucher.owner_id };
  });
}

async function createReviewByVoucherId(profileId: string, voucherId: string): Promise<ReviewRequest | null> {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const [voucher] = await transaction<{ id: string; owner_id: string }[]>`
      select id::text, owner_id::text
      from dunnes_vouchers
      where id = ${voucherId}::uuid
        and reserved_by = ${profileId}::uuid
        and status = 'reserved'
      for update
    `;
    if (!voucher) return null;

    await transaction`
      update dunnes_vouchers
      set reserved_by = null,
          reserved_at = null,
          used_at = null,
          updated_at = now()
      where id = ${voucher.id}::uuid
        and reserved_by = ${profileId}::uuid
        and status = 'reserved'
    `;

    await transaction`
      insert into user_notifications (
        recipient_profile_id,
        actor_profile_id,
        voucher_id,
        type,
        status
      )
      values (
        ${voucher.owner_id}::uuid,
        ${profileId}::uuid,
        ${voucher.id}::uuid,
        'voucher_unused_confirmation',
        'unread'
      )
    `;

    return { voucherId: voucher.id, ownerId: voucher.owner_id };
  });
}

export async function requestUnusedReviewByImage(profileId: string, imageData: string) {
  return createReviewByImage(profileId, imageData);
}

export async function requestUnusedReviewByVoucherId(profileId: string, voucherId: string) {
  return createReviewByVoucherId(profileId, voucherId);
}

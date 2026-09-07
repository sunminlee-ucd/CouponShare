import { getSqlClient } from "@/db";
import { notificationCopy, type NotificationLanguage, type NotificationType, type VoucherType } from "./copy";
import { sendWebPush } from "./web-push";

type NotificationRow = {
  id: string;
  profile_id: string;
  notification_type: NotificationType;
  voucher_type: VoucherType;
  push_dispatched_at: string | null;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  language: NotificationLanguage;
  delivery_status: "pending" | "sent" | "failed" | "gone" | null;
  attempts: number | null;
};

function conciseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

export async function dispatchNotification(notificationId: string) {
  const sql = getSqlClient();
  const [notification] = await sql<NotificationRow[]>`
    select
      n.id::text,
      n.profile_id::text,
      n.notification_type,
      v.voucher_type,
      n.push_dispatched_at::text
    from app_notifications n
    join dunnes_vouchers v on v.id = n.voucher_id
    where n.id = ${notificationId}::uuid
    limit 1
  `;
  if (!notification || notification.push_dispatched_at) return;

  const subscriptions = await sql<SubscriptionRow[]>`
    select
      s.id::text,
      s.endpoint,
      s.p256dh,
      s.auth,
      s.language,
      d.status as delivery_status,
      d.attempts
    from web_push_subscriptions s
    left join notification_push_deliveries d
      on d.subscription_id = s.id
     and d.notification_id = ${notification.id}::uuid
    where s.profile_id = ${notification.profile_id}::uuid
      and s.disabled_at is null
    order by s.updated_at desc
    limit 5
  `;

  if (!subscriptions.length) {
    await sql`update app_notifications set push_dispatched_at = now() where id = ${notification.id}::uuid`;
    return;
  }

  let retryNeeded = false;
  await Promise.all(subscriptions.map(async (subscription) => {
    if (subscription.delivery_status === "sent" || subscription.delivery_status === "gone") return;
    if ((subscription.attempts ?? 0) >= 3) return;

    const copy = notificationCopy(notification.notification_type, notification.voucher_type, subscription.language);
    const payload = {
      title: copy.title,
      body: copy.body,
      url: `/dunnes?notification=${notification.id}`,
      tag: `couponshare-${notification.id}`,
    };

    try {
      const result = await sendWebPush(subscription, payload);
      if (result.ok) {
        await sql.begin(async (transaction) => {
          await transaction`
            insert into notification_push_deliveries (
              notification_id, subscription_id, attempts, status, response_status, attempted_at, sent_at
            ) values (
              ${notification.id}::uuid, ${subscription.id}::uuid, 1, 'sent', ${result.status}, now(), now()
            )
            on conflict (notification_id, subscription_id) do update
              set attempts = notification_push_deliveries.attempts + 1,
                  status = 'sent',
                  response_status = excluded.response_status,
                  last_error = null,
                  attempted_at = now(),
                  sent_at = now()
          `;
          await transaction`
            update web_push_subscriptions
            set last_success_at = now(), updated_at = now()
            where id = ${subscription.id}::uuid
          `;
        });
        return;
      }

      if (result.status === 404 || result.status === 410) {
        await sql.begin(async (transaction) => {
          await transaction`
            insert into notification_push_deliveries (
              notification_id, subscription_id, attempts, status, response_status, attempted_at
            ) values (
              ${notification.id}::uuid, ${subscription.id}::uuid, 1, 'gone', ${result.status}, now()
            )
            on conflict (notification_id, subscription_id) do update
              set attempts = notification_push_deliveries.attempts + 1,
                  status = 'gone',
                  response_status = excluded.response_status,
                  attempted_at = now()
          `;
          await transaction`
            update web_push_subscriptions
            set disabled_at = now(), updated_at = now()
            where id = ${subscription.id}::uuid
          `;
        });
        return;
      }

      const nextAttempts = (subscription.attempts ?? 0) + 1;
      retryNeeded ||= nextAttempts < 3;
      await sql`
        insert into notification_push_deliveries (
          notification_id, subscription_id, attempts, status, response_status, attempted_at
        ) values (
          ${notification.id}::uuid, ${subscription.id}::uuid, 1, 'failed', ${result.status}, now()
        )
        on conflict (notification_id, subscription_id) do update
          set attempts = notification_push_deliveries.attempts + 1,
              status = 'failed',
              response_status = excluded.response_status,
              attempted_at = now()
      `;
    } catch (error) {
      const nextAttempts = (subscription.attempts ?? 0) + 1;
      retryNeeded ||= nextAttempts < 3;
      await sql`
        insert into notification_push_deliveries (
          notification_id, subscription_id, attempts, status, last_error, attempted_at
        ) values (
          ${notification.id}::uuid, ${subscription.id}::uuid, 1, 'failed', ${conciseError(error)}, now()
        )
        on conflict (notification_id, subscription_id) do update
          set attempts = notification_push_deliveries.attempts + 1,
              status = 'failed',
              last_error = excluded.last_error,
              attempted_at = now()
      `;
    }
  }));

  if (!retryNeeded) {
    await sql`update app_notifications set push_dispatched_at = now() where id = ${notification.id}::uuid`;
  }
}

export async function dispatchPendingNotifications() {
  const sql = getSqlClient();
  const pending = await sql<{ id: string }[]>`
    select id::text
    from app_notifications
    where push_dispatched_at is null
      and created_at >= now() - interval '7 days'
    order by created_at asc
    limit 20
  `;
  await Promise.all(pending.map((notification) => dispatchNotification(notification.id)));
  return pending.length;
}

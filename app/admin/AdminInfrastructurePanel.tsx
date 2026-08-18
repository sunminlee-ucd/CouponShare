import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/app/admin/session";
import styles from "./AdminInfrastructurePanel.module.css";

type Metrics = {
  db_bytes: string;
  profiles: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  dunnes_vouchers: number;
  voucher_image_bytes: string;
  action_requests_month: string;
};

const SUPABASE_FREE_DB_BYTES = 500 * 1024 * 1024;
const SUPABASE_FREE_MAU = 50_000;
const CLOUD_RUN_FREE_REQUESTS = 2_000_000;

function percent(value: number, limit: number) {
  return Math.max(0, Math.min(999, (value / limit) * 100));
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IE").format(Math.round(value));
}

function level(value: number) {
  if (value >= 85) return "danger" as const;
  if (value >= 70) return "warn" as const;
  return "ok" as const;
}

function capacityClass(value: number) {
  const state = level(value);
  return state === "danger" ? styles.danger : state === "warn" ? styles.warn : "";
}

function statusClass(state: ReturnType<typeof level>) {
  return state === "danger" ? `${styles.status} ${styles.statusDanger}` : state === "warn" ? `${styles.status} ${styles.statusWarn}` : styles.status;
}

function statusText(state: ReturnType<typeof level>, product: "supabase" | "cloudrun") {
  if (state === "danger") return product === "supabase" ? "유료 전환 권장" : "유료 사용 가능성 높음";
  if (state === "warn") return product === "supabase" ? "용량 주의 · 전환 준비" : "무료 구간 주의";
  return "무료 구간 여유";
}

function barStyle(value: number) {
  return { "--capacity-width": `${Math.min(100, value)}%` } as CSSProperties;
}

export default async function AdminInfrastructurePanel() {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value, password)) return null;

  try {
    const sql = getSqlClient();
    const [metrics] = await sql<Metrics[]>`
      select
        pg_database_size(current_database())::text as db_bytes,
        (select count(*)::int from profiles) as profiles,
        (select count(*)::int from profiles where updated_at >= now() - interval '1 day') as active_today,
        (select count(*)::int from profiles where updated_at >= now() - interval '7 days') as active_7d,
        (select count(*)::int from profiles where updated_at >= now() - interval '30 days') as active_30d,
        (select count(*)::int from dunnes_vouchers) as dunnes_vouchers,
        (select coalesce(sum(octet_length(image_data) + coalesce(octet_length(membership_image_data), 0)), 0)::text from dunnes_vouchers) as voucher_image_bytes,
        (select coalesce(sum(request_count), 0)::text from api_rate_limits where window_start >= date_trunc('month', now())) as action_requests_month
    `;

    const dbBytes = Number(metrics?.db_bytes ?? 0);
    const imageBytes = Number(metrics?.voucher_image_bytes ?? 0);
    const activeToday = Number(metrics?.active_today ?? 0);
    const active7d = Number(metrics?.active_7d ?? 0);
    const active30d = Number(metrics?.active_30d ?? 0);
    const observedActions = Number(metrics?.action_requests_month ?? 0);

    const dbPct = percent(dbBytes, SUPABASE_FREE_DB_BYTES);
    const mauPct = percent(active30d, SUPABASE_FREE_MAU);
    const supabasePct = Math.max(dbPct, mauPct);
    const supabaseLevel = level(supabasePct);

    // Dunnes currently polls roughly every 15 seconds. For planning only, assume an active user
    // leaves the page open for about 20 minutes per active day: ~80 polling requests/day.
    const estimatedDailyActive = Math.max(activeToday, Math.ceil(active7d / 7));
    const estimatedMonthlyPolling = estimatedDailyActive * 80 * 30;
    const estimatedCloudRunRequests = estimatedMonthlyPolling + observedActions;
    const cloudRunPct = percent(estimatedCloudRunRequests, CLOUD_RUN_FREE_REQUESTS);
    const cloudRunLevel = level(cloudRunPct);

    return (
      <details className={styles.panel}>
        <summary>Infrastructure capacity</summary>
        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.heading}><strong>Supabase Free</strong><span>현재 사용량</span></div>
            <div className={capacityClass(dbPct)}>
              <div className={styles.metric}>
                <span>Database</span><strong>{formatBytes(dbBytes)} / 500 MB</strong>
                <div className={styles.bar}><i style={barStyle(dbPct)} /></div>
              </div>
            </div>
            <div className={capacityClass(mauPct)}>
              <div className={styles.metric}>
                <span>30일 활성 사용자 proxy</span><strong>{formatNumber(active30d)} / 50,000</strong>
                <div className={styles.bar}><i style={barStyle(mauPct)} /></div>
              </div>
            </div>
            <div className={styles.metric}><span>전체 profile</span><strong>{formatNumber(Number(metrics?.profiles ?? 0))}</strong></div>
            <div className={styles.metric}><span>Dunnes 바우처</span><strong>{formatNumber(Number(metrics?.dunnes_vouchers ?? 0))}</strong></div>
            <div className={styles.metric}><span>DB에 저장된 바우처 이미지</span><strong>{formatBytes(imageBytes)}</strong></div>
            <div className={statusClass(supabaseLevel)}>{statusText(supabaseLevel, "supabase")}</div>
            <p className={styles.note}>운영 기준: Free 한도의 70%부터 주의, 85%부터 Pro 전환을 권장합니다. 이 70%/85% 기준은 CouponShare 운영 안전 마진이며 Supabase의 공식 강제 전환 기준은 아닙니다. Free는 자동 백업이 없고 장기간 비활성 시 project가 pause될 수 있으므로 공개 서비스라면 용량과 별개로 Pro를 고려하세요.</p>
          </section>

          <section className={styles.section}>
            <div className={styles.heading}><strong>Cloud Run</strong><span>request-based 추정</span></div>
            <div className={capacityClass(cloudRunPct)}>
              <div className={styles.metric}>
                <span>월 요청 예상</span><strong>{formatNumber(estimatedCloudRunRequests)} / 2,000,000</strong>
                <div className={styles.bar}><i style={barStyle(cloudRunPct)} /></div>
              </div>
            </div>
            <div className={styles.metric}><span>오늘 활성 profile</span><strong>{formatNumber(activeToday)}</strong></div>
            <div className={styles.metric}><span>7일 활성 profile</span><strong>{formatNumber(active7d)}</strong></div>
            <div className={styles.metric}><span>이번 달 기록된 API action</span><strong>{formatNumber(observedActions)}</strong></div>
            <div className={statusClass(cloudRunLevel)}>{statusText(cloudRunLevel, "cloudrun")}</div>
            <p className={styles.note}>Cloud Run은 별도 유료 플랜으로 업그레이드하는 구조가 아니라 무료 구간을 넘으면 사용량 기반 과금이 시작됩니다. 요청 예상치는 15초 polling과 활성 사용자당 하루 약 20분 사용을 가정한 planning estimate입니다. 무료 구간은 billing account의 다른 project 사용량에도 영향을 받을 수 있으며, CPU·RAM·egress의 정확한 과금 여부는 Google Cloud Billing/Monitoring이 최종 기준입니다.</p>
          </section>
        </div>
      </details>
    );
  } catch {
    return (
      <details className={styles.panel}>
        <summary>Infrastructure capacity</summary>
        <div className={styles.error}>인프라 사용량을 계산하지 못했습니다. DB 연결과 권한을 확인해 주세요.</div>
      </details>
    );
  }
}

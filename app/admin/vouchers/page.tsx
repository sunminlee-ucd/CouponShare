import AdminReviewTabs from "@/app/admin/AdminReviewTabs";
import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import { requireAdminPage } from "@/app/admin/require-page-session";
import { LIDL_ENABLED } from "@/app/features";
import { getSqlClient } from "@/db";

export const dynamic = "force-dynamic";

type LidlReview = {
  card_id: string;
  card_label: string;
  review_status: "pending" | "approved" | "rejected";
  coupon_count: number;
  updated_at: string;
};

type DunnesReview = {
  voucher_id: string;
  voucher_label: string;
  membership_required: boolean;
  expires_on: string;
  updated_at: string;
};

type DunnesReport = {
  report_id: string;
  voucher_id: string;
  voucher_label: string;
  reason: "invalid_voucher" | "membership_not_scanned";
  report_count: number;
  created_at: string;
};

type LidlReport = {
  card_id: string;
  card_label: string;
  reason: "invalid_qr" | "unrelated_image" | "coupon_mismatch";
  report_count: number;
  created_at: string;
};

type VoucherBundle = {
  lidl_reviews: LidlReview[];
  dunnes_reviews: DunnesReview[];
  lidl_reports: LidlReport[];
  dunnes_reports: DunnesReport[];
};

const EMPTY: VoucherBundle = {
  lidl_reviews: [],
  dunnes_reviews: [],
  lidl_reports: [],
  dunnes_reports: [],
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Admin voucher query timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default async function AdminVouchersPage() {
  await requireAdminPage("/admin/vouchers");

  let unavailable = false;
  let bundle = EMPTY;

  try {
    const sql = getSqlClient();
    const [loaded] = await withTimeout(sql<VoucherBundle[]>`
      select
        coalesce((select json_agg(row_to_json(items)) from (
          select card.id::text as card_id,
            '공유 카드 · ' || upper(substr(md5(card.owner_id::text || current_date::text), 1, 3)) as card_label,
            card.review_status,
            count(c.id) filter (where c.is_active = true and c.used_at is null)::int as coupon_count,
            to_char(card.updated_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as updated_at
          from lidl_cards card
          left join coupons c on c.owner_id = card.owner_id
          group by card.id
          order by (card.review_status = 'pending') desc, card.updated_at desc
          limit 20
        ) items), '[]'::json) as lidl_reviews,
        coalesce((select json_agg(row_to_json(items)) from (
          select id::text as voucher_id,
            case voucher_type when '5off25' then '€5 할인' else '€10 할인' end as voucher_label,
            membership_required, expires_on::text,
            to_char(updated_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as updated_at
          from dunnes_vouchers
          where review_status = 'pending'
          order by updated_at asc
          limit 20
        ) items), '[]'::json) as dunnes_reviews,
        coalesce((select json_agg(row_to_json(items)) from (
          select r.card_id::text,
            '공유 카드 · ' || upper(substr(md5(card.owner_id::text || current_date::text), 1, 3)) as card_label,
            r.reason, count(*)::int as report_count,
            to_char(min(r.created_at) at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as created_at
          from lidl_card_reports r
          join lidl_cards card on card.id = r.card_id
          where r.status = 'open'
          group by r.card_id, card.owner_id, r.reason
          order by min(r.created_at) asc
          limit 20
        ) items), '[]'::json) as lidl_reports,
        coalesce((select json_agg(row_to_json(items)) from (
          select min(r.id::text) as report_id, r.voucher_id::text,
            case v.voucher_type when '5off25' then '€5 할인' else '€10 할인' end as voucher_label,
            r.reason, count(*)::int as report_count,
            to_char(min(r.created_at) at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as created_at
          from dunnes_voucher_reports r
          join dunnes_vouchers v on v.id = r.voucher_id
          where r.status = 'open'
          group by r.voucher_id, v.voucher_type, r.reason
          order by min(r.created_at) asc
          limit 20
        ) items), '[]'::json) as dunnes_reports
    `, 3_000);
    if (loaded) bundle = loaded;
  } catch (error) {
    unavailable = true;
    console.error("Admin voucher lookup failed", error);
  }

  const { lidl_reviews: lidlReviews, dunnes_reviews: dunnesReviews, lidl_reports: lidlReports, dunnes_reports: dunnesReports } = bundle;

  return (
    <AdminSectionFrame>
      <section className="admin-main">
        {unavailable && <p className="admin-data-warning" role="status">바우처 검수 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
        <div className="admin-heading">
          <div><p className="eyebrow">VOUCHER OPERATIONS</p><h1>바우처 관리</h1><p>현황과 검수 데이터는 이 메뉴를 열 때만 불러옵니다.</p></div>
          <span className="admin-date">Ireland · {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "Europe/Dublin" }).format(new Date())}</span>
        </div>
        <div className="admin-grid">
          <div className="admin-column">
            <AdminReviewTabs
              dunnesCount={dunnesReviews.length + dunnesReports.length}
              lidlCount={lidlReviews.length + lidlReports.length}
              lidlEnabled={LIDL_ENABLED}
              dunnes={<>
                <section className="admin-panel">
                  <header className="admin-panel-head"><h2>Dunnes 바우처 검수</h2><span>바코드 원본 비노출</span></header>
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>종류</th><th>멤버십</th><th>만료일</th><th>처리</th></tr></thead><tbody>
                    {dunnesReviews.length ? dunnesReviews.map((review) => <tr key={review.voucher_id}><td><strong>{review.voucher_label}</strong><small className="admin-cell-note">{review.updated_at}</small></td><td>{review.membership_required ? "필요" : "불필요"}</td><td>{review.expires_on}</td><td><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={review.voucher_id} /><button name="action" value="approve_dunnes" type="submit">승인</button><button className="danger" name="action" value="reject_dunnes" type="submit" title="바우처를 영구 삭제합니다">거절·삭제</button></form></td></tr>) : <tr><td colSpan={4}>검수할 Dunnes 바우처가 없습니다.</td></tr>}
                  </tbody></table></div>
                </section>
                <section className="admin-panel">
                  <header className="admin-panel-head"><h2>Dunnes 신고</h2><span>신고 2건부터 자동 재검수</span></header>
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>바우처</th><th>사유</th><th>신고</th><th>처리</th></tr></thead><tbody>
                    {dunnesReports.length ? dunnesReports.map((report) => <tr key={`${report.voucher_id}-${report.reason}`}><td><strong>{report.voucher_label}</strong><small className="admin-cell-note">{report.created_at}</small></td><td>{report.reason === "invalid_voucher" ? "유효하지 않음" : "멤버십 스캔 누락"}</td><td>{report.report_count}건</td><td><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={report.voucher_id} /><button name="action" value="resolve_dunnes_reports" type="submit">문제 없음</button><button className="danger" name="action" value="reject_dunnes" type="submit">바우처 삭제</button></form></td></tr>) : <tr><td colSpan={4}>열린 신고가 없습니다.</td></tr>}
                  </tbody></table></div>
                </section>
              </>}
              lidl={<>
                <section className="admin-panel">
                  <header className="admin-panel-head"><h2>Lidl 업로드 검수</h2><span>QR 원본 비노출</span></header>
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>익명 카드</th><th>활성 쿠폰</th><th>업데이트</th><th>상태</th></tr></thead><tbody>
                    {lidlReviews.length ? lidlReviews.map((review) => <tr key={review.card_id}><td><strong>{review.card_label}</strong></td><td>{review.coupon_count}개</td><td>{review.updated_at}</td><td><span className={review.review_status === "pending" ? "admin-table-status warn" : review.review_status === "rejected" ? "admin-table-status danger" : "admin-table-status"}>{review.review_status === "pending" ? "검수 필요" : review.review_status === "rejected" ? "거절" : "승인"}</span><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={review.card_id} /><button name="action" value="approve_card" type="submit">승인</button><button className="danger" name="action" value="reject_card" type="submit" title="QR과 연결 쿠폰을 영구 삭제합니다">거절·삭제</button></form></td></tr>) : <tr><td colSpan={4}>검수할 Lidl 업로드가 없습니다.</td></tr>}
                  </tbody></table></div>
                </section>
                <section className="admin-panel">
                  <header className="admin-panel-head"><h2>Lidl 신고</h2><span>신고 2명부터 자동 숨김</span></header>
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>공유 카드</th><th>사유</th><th>신고</th><th>처리</th></tr></thead><tbody>
                    {lidlReports.length ? lidlReports.map((report) => <tr key={`${report.card_id}-${report.reason}`}><td><strong>{report.card_label}</strong><small className="admin-cell-note">{report.created_at}</small></td><td>{report.reason === "invalid_qr" ? "QR이 유효하지 않음" : report.reason === "unrelated_image" ? "Lidl QR과 무관한 이미지" : "활성 쿠폰 내역 불일치"}</td><td>{report.report_count}건</td><td><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={report.card_id} /><button name="action" value="resolve_lidl_reports" type="submit">문제 없음</button><button className="danger" name="action" value="reject_card" type="submit">카드 삭제</button></form></td></tr>) : <tr><td colSpan={4}>열린 신고가 없습니다.</td></tr>}
                  </tbody></table></div>
                </section>
              </>}
            />
          </div>
        </div>
        <footer className="admin-footer">© 2026 Sunmin Lee. 관리자 전용 화면.</footer>
      </section>
    </AdminSectionFrame>
  );
}

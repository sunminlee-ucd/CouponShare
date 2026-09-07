import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import { requireAdminPage } from "@/app/admin/require-page-session";
import { getSqlClient } from "@/db";

export const dynamic = "force-dynamic";

type UserErrorReport = {
  report_id: string;
  reporter_label: string;
  category: "screen" | "access" | "coupon" | "other";
  message: string;
  page_path: string;
  status: "open" | "resolved";
  created_at: string;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Admin reports query timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default async function AdminReportsPage() {
  await requireAdminPage("/admin/reports");

  let unavailable = false;
  let reports: UserErrorReport[] = [];

  try {
    const sql = getSqlClient();
    reports = await withTimeout(sql<UserErrorReport[]>`
      select r.id::text as report_id,
        case when p.id is null then '탈퇴 사용자' else '익명 사용자 · ' || upper(substr(md5(p.id::text || current_date::text), 1, 3)) end as reporter_label,
        r.category, r.message, r.page_path, r.status,
        to_char(r.created_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as created_at
      from user_error_reports r
      left join profiles p on p.id = r.reporter_id
      order by (r.status = 'open') desc, r.created_at desc
      limit 50
    `, 3_000);
  } catch (error) {
    unavailable = true;
    console.error("Admin reports lookup failed", error);
  }

  const openCount = reports.filter((report) => report.status === "open").length;

  return (
    <AdminSectionFrame>
      <section className="admin-main">
        {unavailable && <p className="admin-data-warning" role="status">오류 신고 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
        <div className="admin-heading">
          <div><p className="eyebrow">USER REPORTS</p><h1>오류 신고</h1><p>사용자 오류 신고는 Reports 메뉴를 열 때만 조회합니다.</p></div>
          <span className="admin-date">Ireland · {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "Europe/Dublin" }).format(new Date())}</span>
        </div>
        <div className="admin-grid">
          <div className="admin-column">
            <section className="admin-panel" id="error-reports">
              <header className="admin-panel-head"><h2>사용자 오류 신고</h2><span>미처리 {openCount}건</span></header>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>사용자</th><th>종류·화면</th><th>오류 내용</th><th>접수</th><th>처리</th></tr></thead><tbody>
                {reports.length ? reports.map((report) => <tr key={report.report_id}><td><strong>{report.reporter_label}</strong></td><td>{report.category === "screen" ? "화면·버튼" : report.category === "access" ? "로그인·접속" : report.category === "coupon" ? "쿠폰·바우처" : "기타"}<small className="admin-cell-note">{report.page_path}</small></td><td className="admin-error-message">{report.message}</td><td>{report.created_at}<small className="admin-cell-note">{report.status === "open" ? "미처리" : "처리 완료"}</small></td><td>{report.status === "open" ? <form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={report.report_id} /><button name="action" value="resolve_error_report" type="submit">확인 완료</button><button className="danger" name="action" value="delete_error_report" type="submit">삭제</button></form> : <form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={report.report_id} /><button className="danger" name="action" value="delete_error_report" type="submit">삭제</button></form>}</td></tr>) : <tr><td colSpan={5}>접수된 오류 신고가 없습니다.</td></tr>}
              </tbody></table></div>
            </section>
          </div>
        </div>
        <footer className="admin-footer">© 2026 Sunmin Lee. 관리자 전용 화면.</footer>
      </section>
    </AdminSectionFrame>
  );
}

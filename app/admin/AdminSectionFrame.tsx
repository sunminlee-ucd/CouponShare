import Link from "next/link";
import AdminSessionRefresh from "@/app/admin/AdminSessionRefresh";

export default function AdminSectionFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <main className="admin-shell">
        <AdminSessionRefresh />
        <header className="admin-topbar">
          <Link className="brand" href="/" aria-label="CouponShare 메인">
            <span className="brand-mark">C</span>
            <span>CouponShare Admin</span>
          </Link>
          <div className="admin-topbar-actions">
            <span className="admin-access-badge">관리자 전용</span>
            <form action="/api/admin/logout" method="post">
              <button className="admin-logout-button" type="submit">로그아웃</button>
            </form>
            <Link className="admin-back-link" href="/">메인으로</Link>
          </div>
        </header>
      </main>
      {children}
    </>
  );
}

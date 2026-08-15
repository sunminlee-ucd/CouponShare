export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const message = params.error === "invalid_password" ? "비밀번호를 다시 확인해 주세요." : "";

  return <main className="access-shell">
    <section className="access-card admin-login-card">
      <div className="brand"><span className="brand-mark">C</span><span>CouponShare Admin</span></div>
      <p className="eyebrow">ADMIN ACCESS</p>
      <h1>관리자 로그인</h1>
      <p>이 기기에서는 로그인 상태가 유지되며, 이용할 때마다 자동 연장됩니다.</p>
      <form action="/api/admin/login" method="post">
        <label htmlFor="admin-password">관리자 비밀번호</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
        <button type="submit">로그인</button>
      </form>
      {message && <p className="access-error" role="alert">{message}</p>}
    </section>
  </main>;
}

"use client";

import { useMemo, useState } from "react";
import AdminUserResetActions from "./AdminUserResetActions";

export type AdminAccountUser = {
  profile_id: string | null;
  auth_user_id: string;
  email: string | null;
  provider: string | null;
  account_created_at: string | null;
  last_activity: string | null;
  today_reservations: number;
  today_uploads: number;
  registered_vouchers: number;
  risk_score: number;
  is_blocked: boolean;
  today_views: number;
  blocked_attempts: number;
};

type Props = { users: AdminAccountUser[] };
type AccountView = "special" | "all";

function providerLabel(provider: string | null) {
  const normalized = (provider ?? "email").toLowerCase();
  if (normalized === "google") return "Google";
  if (normalized === "email") return "Email";
  return provider || "Email";
}

function hasSpecialActivity(user: AdminAccountUser) {
  return user.is_blocked
    || user.risk_score > 0
    || user.blocked_attempts > 0
    || user.today_reservations > 0
    || user.today_uploads > 0
    || user.today_views > 0
    || user.registered_vouchers > 0;
}

function AccountTable({ users, emptyMessage }: { users: AdminAccountUser[]; emptyMessage: string }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-account-table">
        <thead>
          <tr>
            <th>계정</th>
            <th>로그인 방식</th>
            <th>오늘 사용량</th>
            <th>바우처</th>
            <th>위험 상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          {users.length ? users.map((user) => {
            const accountLabel = user.email || "이메일 정보 없음";
            const canManageProfile = Boolean(user.profile_id);
            const riskActive = user.is_blocked || user.risk_score > 0 || user.blocked_attempts > 0;
            return (
              <tr key={user.auth_user_id}>
                <td>
                  <strong className="admin-account-email">{accountLabel}</strong>
                  <small className="admin-cell-note">
                    {user.profile_id
                      ? `계정 연결됨 · 최근 활동 ${user.last_activity ?? "기록 없음"}`
                      : `가입 ${user.account_created_at ?? "기록 없음"} · 프로필 연결 전`}
                  </small>
                </td>
                <td>
                  <span className={`admin-provider-badge ${providerLabel(user.provider).toLowerCase()}`}>{providerLabel(user.provider)}</span>
                </td>
                <td>
                  {canManageProfile ? <>
                    <strong>예약 {user.today_reservations}/3</strong>
                    <small className="admin-cell-note">등록 {user.today_uploads}/5 · 열람 {user.today_views}</small>
                  </> : <span className="admin-muted-cell">활동 프로필 없음</span>}
                </td>
                <td>{canManageProfile ? `${user.registered_vouchers}개` : "—"}</td>
                <td>
                  {canManageProfile ? <>
                    <span className={user.is_blocked ? "admin-table-status danger" : riskActive ? "admin-table-status warn" : "admin-table-status"}>
                      {user.is_blocked ? "차단됨" : riskActive ? `관찰 · ${user.risk_score}` : "정상"}
                    </span>
                    {user.blocked_attempts > 0 && <small className="admin-cell-note">제한 초과 {user.blocked_attempts}회</small>}
                  </> : <span className="admin-muted-cell">—</span>}
                </td>
                <td>
                  {user.profile_id ? <>
                    <AdminUserResetActions
                      profileId={user.profile_id}
                      userLabel={accountLabel}
                      registeredVouchers={user.registered_vouchers}
                    />
                    <form className="admin-inline-actions admin-account-block-actions" action="/api/admin/moderation" method="post">
                      <input type="hidden" name="targetId" value={user.profile_id} />
                      <button
                        className={user.is_blocked ? "" : "danger"}
                        name="action"
                        value={user.is_blocked ? "unblock_user" : "block_user"}
                        type="submit"
                      >
                        {user.is_blocked ? "차단 해제" : "사용자 차단"}
                      </button>
                    </form>
                  </> : <span className="admin-muted-cell">첫 로그인 후 관리 가능</span>}
                </td>
              </tr>
            );
          }) : <tr><td colSpan={6}>{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAccountUsersTable({ users }: Props) {
  const [query, setQuery] = useState("");
  const [accountView, setAccountView] = useState<AccountView>("special");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users;
    return users.filter((user) => {
      const searchable = `${user.email ?? "email unavailable"} ${providerLabel(user.provider)}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, users]);

  const specialUsers = useMemo(
    () => filteredUsers.filter(hasSpecialActivity),
    [filteredUsers],
  );
  const ordinaryUsers = useMemo(
    () => filteredUsers.filter((user) => !hasSpecialActivity(user)),
    [filteredUsers],
  );

  const linkedCount = users.filter((user) => Boolean(user.profile_id)).length;
  const pendingProfileCount = users.length - linkedCount;
  const totalSpecialCount = users.filter(hasSpecialActivity).length;
  const totalOrdinaryCount = users.length - totalSpecialCount;

  return (
    <section className="admin-account-users-panel">
      <div className="admin-account-summary">
        <article><span>Auth 계정</span><strong>{users.length}</strong><small>Supabase auth.users</small></article>
        <article><span>프로필 연결</span><strong>{linkedCount}</strong><small>연결 전 {pendingProfileCount}명</small></article>
        <article><span>특별 활동</span><strong>{totalSpecialCount}</strong><small>활동 없음 {totalOrdinaryCount}명</small></article>
      </div>

      <section className="admin-panel">
        <header className="admin-panel-head admin-account-users-head">
          <div>
            <h2>계정 사용자 관리</h2>
            <span>바우처 등록·예약·열람·제한 초과·위험 상태 등 특별 활동이 있는 계정을 먼저 확인합니다.</span>
          </div>
          <label className="admin-account-search">
            <span>계정 검색</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이메일 또는 Google / Email"
              autoComplete="off"
            />
          </label>
        </header>

        <div className="admin-secondary-tabs admin-account-focus-tabs" role="tablist" aria-label="사용자 계정 분류">
          <button
            aria-selected={accountView === "special"}
            className={accountView === "special" ? "active" : ""}
            onClick={() => setAccountView("special")}
            role="tab"
            type="button"
          >
            특별 활동 {totalSpecialCount}
          </button>
          <button
            aria-selected={accountView === "all"}
            className={accountView === "all" ? "active" : ""}
            onClick={() => setAccountView("all")}
            role="tab"
            type="button"
          >
            전체 계정 {users.length}
          </button>
        </div>

        {accountView === "special" ? (
          <div className="admin-account-classification">
            <div className="admin-account-classification-head">
              <strong>특별 활동 사용자</strong>
              <span>활동이 감지된 계정을 상단에 우선 표시합니다.</span>
            </div>
            <AccountTable users={specialUsers} emptyMessage={normalizedQuery ? "검색 조건에 맞는 특별 활동 사용자가 없습니다." : "현재 특별 활동이 있는 사용자가 없습니다."} />

            <details className="admin-ordinary-users" open={Boolean(normalizedQuery)}>
              <summary>
                <span>특별 활동 없음</span>
                <strong>{ordinaryUsers.length}명</strong>
                <small>{normalizedQuery ? "검색 결과" : "눌러서 펼치기"}</small>
              </summary>
              <p className="admin-action-note">오늘 바우처 등록·예약·열람, 제한 초과, 위험 상태 또는 등록 바우처 기록이 없는 계정입니다.</p>
              <AccountTable users={ordinaryUsers} emptyMessage="조건에 맞는 일반 사용자가 없습니다." />
            </details>
          </div>
        ) : (
          <>
            <p className="admin-action-note" role="status">전체 계정에서는 Supabase Auth에 가입된 모든 계정을 확인할 수 있습니다. 프로필이 아직 연결되지 않은 계정은 첫 로그인 후 관리 기능이 활성화됩니다.</p>
            <AccountTable users={filteredUsers} emptyMessage="검색 조건과 일치하는 계정이 없습니다." />
          </>
        )}
      </section>
    </section>
  );
}

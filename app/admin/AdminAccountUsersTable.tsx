"use client";

import { useMemo, useState } from "react";
import AdminUserResetActions from "./AdminUserResetActions";

export type AdminAccountUser = {
  profile_id: string | null;
  auth_user_id: string | null;
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

function providerLabel(provider: string | null) {
  const normalized = (provider ?? "email").toLowerCase();
  if (normalized === "google") return "Google";
  if (normalized === "email") return "Email";
  return provider || "Email";
}

export default function AdminAccountUsersTable({ users }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users;
    return users.filter((user) => {
      const searchable = `${user.email ?? "guest unlinked"} ${providerLabel(user.provider)}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, users]);

  const accountCount = users.filter((user) => Boolean(user.auth_user_id)).length;
  const linkedCount = users.filter((user) => Boolean(user.auth_user_id && user.profile_id)).length;
  const guestCount = users.filter((user) => !user.auth_user_id && Boolean(user.profile_id)).length;

  return (
    <section className="admin-account-users-panel">
      <div className="admin-account-summary">
        <article><span>Auth 계정</span><strong>{accountCount}</strong><small>Supabase auth.users</small></article>
        <article><span>프로필 연결</span><strong>{linkedCount}</strong><small>CouponShare 활동 관리 가능</small></article>
        <article><span>Guest / 미연결</span><strong>{guestCount}</strong><small>계정 없이 생성된 기존 프로필</small></article>
      </div>

      <section className="admin-panel">
        <header className="admin-panel-head admin-account-users-head">
          <div>
            <h2>계정 사용자 관리</h2>
            <span>이메일과 로그인 방식 기준으로 사용자를 관리합니다.</span>
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
        <p className="admin-action-note" role="status">로그인 계정이 연결된 사용자는 이메일 주소를 기준으로 표시합니다. 계정이 없는 예전 프로필은 Guest / 계정 미연결로만 구분합니다.</p>
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
              {filteredUsers.length ? filteredUsers.map((user, index) => {
                const accountLabel = user.email || "Guest / 계정 미연결";
                const canManageProfile = Boolean(user.profile_id);
                const riskActive = user.is_blocked || user.risk_score > 0 || user.blocked_attempts > 0;
                return (
                  <tr key={user.auth_user_id ?? user.profile_id ?? `user-${index}`}>
                    <td>
                      <strong className="admin-account-email">{accountLabel}</strong>
                      <small className="admin-cell-note">
                        {user.auth_user_id
                          ? user.profile_id
                            ? `계정 연결됨 · 최근 활동 ${user.last_activity ?? "기록 없음"}`
                            : `가입 ${user.account_created_at ?? "기록 없음"} · 프로필 연결 전`
                          : `최근 활동 ${user.last_activity ?? "기록 없음"}`}
                      </small>
                    </td>
                    <td>
                      {user.auth_user_id
                        ? <span className={`admin-provider-badge ${providerLabel(user.provider).toLowerCase()}`}>{providerLabel(user.provider)}</span>
                        : <span className="admin-provider-badge guest">Guest</span>}
                    </td>
                    <td>
                      {canManageProfile ? <>
                        <strong>예약 {user.today_reservations}/3</strong>
                        <small className="admin-cell-note">등록 {user.today_uploads}/2 · 열람 {user.today_views}</small>
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
              }) : <tr><td colSpan={6}>검색 조건과 일치하는 계정이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

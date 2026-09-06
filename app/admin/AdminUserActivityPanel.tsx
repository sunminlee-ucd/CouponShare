"use client";

import { useEffect, useMemo, useState } from "react";

type Summary = {
  online_now: number;
  sessions_today: number;
  unique_users_today: number;
  total_sessions: number;
  tracked_users: number;
  page_views_today: number;
};

type UserActivity = {
  profile_id: string;
  user_label: string;
  provider: string | null;
  is_online: boolean;
  today_sessions: number;
  total_sessions: number;
  today_page_views: number;
  total_page_views: number;
  total_minutes: number;
  last_entered_at: string | null;
  last_exit_at: string | null;
};

type RecentSession = {
  session_id: string;
  user_label: string;
  provider: string | null;
  status: "online" | "ended" | "stale";
  started_at: string;
  ended_at: string | null;
  last_seen_at: string;
  page_views: number;
  duration_minutes: number;
  last_path: string;
};

type Payload = { summary?: Summary; users?: UserActivity[]; recent?: RecentSession[] };

const EMPTY: Summary = {
  online_now: 0,
  sessions_today: 0,
  unique_users_today: 0,
  total_sessions: 0,
  tracked_users: 0,
  page_views_today: 0,
};

function providerLabel(provider: string | null) {
  if (!provider) return "Guest/Profile";
  return provider.toLowerCase() === "google" ? "Google" : provider.toLowerCase() === "email" ? "Email" : provider;
}

function sessionStatus(session: RecentSession) {
  if (session.status === "online") return { label: "접속 중", className: "online" };
  if (session.status === "stale") return { label: "연결 종료 추정", className: "stale" };
  return { label: "종료", className: "ended" };
}

export default function AdminUserActivityPanel() {
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const response = await fetch("/api/admin/user-activity", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error("load_failed");
        const payload = await response.json() as Payload;
        if (disposed) return;
        setSummary(payload.summary ?? EMPTY);
        setUsers(payload.users ?? []);
        setRecent(payload.recent ?? []);
        setFailed(false);
        setLastUpdatedAt(new Date());
      } catch {
        if (!disposed) setFailed(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users;
    return users.filter((user) => `${user.user_label} ${user.provider ?? ""}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, users]);

  return (
    <section className="admin-user-activity-panel">
      <div className="admin-user-activity-summary">
        <article className="online"><span>현재 접속</span><strong>{summary.online_now}</strong><small>최근 2분 heartbeat 기준</small></article>
        <article><span>오늘 접속</span><strong>{summary.sessions_today}</strong><small>고유 사용자 {summary.unique_users_today}명</small></article>
        <article><span>누적 접속</span><strong>{summary.total_sessions}</strong><small>추적 사용자 {summary.tracked_users}명</small></article>
        <article><span>오늘 페이지 이동</span><strong>{summary.page_views_today}</strong><small>로그인 사용자 세션 합계</small></article>
      </div>

      <section className="admin-panel">
        <header className="admin-panel-head admin-user-activity-head">
          <div>
            <h2>사용자 접속 현황</h2>
            <span>누가 언제 들어왔고 나갔는지, 접속 횟수와 활동량을 사용자별로 확인합니다.</span>
          </div>
          <div className="admin-user-activity-tools">
            <small>{failed ? "갱신 실패 · 자동 재시도" : lastUpdatedAt ? `10초 자동 갱신 · ${lastUpdatedAt.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "불러오는 중"}</small>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이메일 또는 사용자 검색" autoComplete="off" />
          </div>
        </header>
        <p className="admin-action-note">페이지를 닫는 이벤트를 브라우저가 전달하지 못한 경우에는 마지막 heartbeat가 2분 이상 지나면 ‘연결 종료 추정’으로 표시합니다. 따라서 비정상 종료도 계속 ‘접속 중’으로 남지 않습니다.</p>
        <div className="admin-table-wrap">
          <table className="admin-table admin-user-activity-table">
            <thead><tr><th>사용자</th><th>현재</th><th>오늘 접속</th><th>누적 접속</th><th>페이지 이동</th><th>최근 입장 / 이탈</th><th>누적 체류</th></tr></thead>
            <tbody>
              {filteredUsers.length ? filteredUsers.map((user) => (
                <tr key={user.profile_id}>
                  <td><strong>{user.user_label}</strong><small className="admin-cell-note">{providerLabel(user.provider)}</small></td>
                  <td><span className={`admin-session-status ${user.is_online ? "online" : "ended"}`}>{user.is_online ? "접속 중" : "오프라인"}</span></td>
                  <td><strong>{user.today_sessions}회</strong><small className="admin-cell-note">페이지 {user.today_page_views}회</small></td>
                  <td>{user.total_sessions}회</td>
                  <td>{user.total_page_views}회</td>
                  <td><span>{user.last_entered_at ?? "—"}</span><small className="admin-cell-note">이탈 {user.is_online ? "접속 중" : user.last_exit_at ?? "기록 없음"}</small></td>
                  <td>{user.total_minutes}분</td>
                </tr>
              )) : <tr><td colSpan={7}>아직 기록된 로그인 사용자 접속이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <header className="admin-panel-head"><h2>최근 입장·이탈 기록</h2><span>최근 {recent.length}개 세션</span></header>
        <div className="admin-table-wrap">
          <table className="admin-table admin-session-history-table">
            <thead><tr><th>사용자</th><th>입장</th><th>이탈 / 마지막 확인</th><th>상태</th><th>체류</th><th>페이지</th><th>마지막 화면</th></tr></thead>
            <tbody>
              {recent.length ? recent.map((session) => {
                const status = sessionStatus(session);
                return (
                  <tr key={session.session_id}>
                    <td><strong>{session.user_label}</strong><small className="admin-cell-note">{providerLabel(session.provider)}</small></td>
                    <td>{session.started_at}</td>
                    <td>{session.ended_at ?? session.last_seen_at}</td>
                    <td><span className={`admin-session-status ${status.className}`}>{status.label}</span></td>
                    <td>{session.duration_minutes}분</td>
                    <td>{session.page_views}회</td>
                    <td><code className="admin-session-path">{session.last_path}</code></td>
                  </tr>
                );
              }) : <tr><td colSpan={7}>아직 접속 기록이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./AdminDunnesUsageSummary.module.css";

type Summary = {
  total_used: number;
  used_today: number;
  used_last_7_days: number;
  users_today: number;
};

type Daily = { usage_date: string; uses: number };
type Recent = {
  voucher_id: string;
  voucher_label: string;
  owner_label: string;
  user_label: string;
  membership_required: boolean;
  used_at: string;
};

type Payload = { summary?: Summary; daily?: Daily[]; recent?: Recent[] };

const EMPTY_SUMMARY: Summary = { total_used: 0, used_today: 0, used_last_7_days: 0, users_today: 0 };

export default function AdminDunnesUsageSummary() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [failed, setFailed] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const response = await fetch("/api/admin/dunnes-usage", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error("load_failed");
        const payload = await response.json() as Payload;
        if (disposed) return;
        setSummary(payload.summary ?? EMPTY_SUMMARY);
        setDaily(payload.daily ?? []);
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

  const maxDaily = useMemo(() => Math.max(1, ...daily.map((item) => item.uses)), [daily]);

  return (
    <section className={`admin-panel ${styles.panel}`} aria-label="Dunnes 사용완료 현황">
      <header className="admin-panel-head">
        <div>
          <h2>사용완료 현황</h2>
          <p className={styles.copy}>사용자가 사용완료를 누른 바우처를 실시간으로 집계합니다.</p>
        </div>
        <span>{failed ? "갱신 실패 · 자동 재시도" : lastUpdatedAt ? `10초 자동 갱신 · ${lastUpdatedAt.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "불러오는 중"}</span>
      </header>

      <div className={styles.stats}>
        <article><span>오늘 사용완료</span><strong>{summary.used_today}</strong><small>바우처</small></article>
        <article><span>오늘 사용 사용자</span><strong>{summary.users_today}</strong><small>명</small></article>
        <article><span>최근 7일</span><strong>{summary.used_last_7_days}</strong><small>바우처</small></article>
        <article><span>누적 사용완료</span><strong>{summary.total_used}</strong><small>바우처</small></article>
      </div>

      <div className={styles.trend} aria-label="최근 7일 사용완료 추이">
        {daily.map((item) => (
          <div key={item.usage_date} className={styles.trendItem}>
            <strong>{item.uses}</strong>
            <div><i style={{ height: `${Math.max(8, Math.round((item.uses / maxDaily) * 100))}%` }} /></div>
            <span>{item.usage_date}</span>
          </div>
        ))}
      </div>

      <details className={styles.recent}>
        <summary>최근 사용완료 내역 {recent.length}건</summary>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>바우처</th><th>사용자</th><th>등록자</th><th>사용완료 시각</th></tr></thead>
            <tbody>
              {recent.length ? recent.map((item) => (
                <tr key={item.voucher_id}>
                  <td><strong>{item.voucher_label}</strong><small className="admin-cell-note">{item.membership_required ? "ValueClub 필요" : "ValueClub 불필요"}</small></td>
                  <td>{item.user_label}</td>
                  <td>{item.owner_label}</td>
                  <td>{item.used_at}</td>
                </tr>
              )) : <tr><td colSpan={4}>아직 사용완료된 바우처가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LIDL_ENABLED } from "@/app/features";

type DashboardSummary = {
  summary: {
    profiles: number;
    shared_cards: number;
    active_coupons: number;
    pending_lidl: number;
    pending_dunnes: number;
    open_lidl_reports: number;
    open_dunnes_reports: number;
    risk_users: number;
  };
  daily: { qr_views: number; blocked_attempts: number };
  dunnes_today: { viewers: number; views: number; users: number; uses: number };
};

type LoadState = "loading" | "ready" | "error";

export default function AdminDashboardSummary() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    setState("loading");

    try {
      const response = await fetch("/api/admin/summary", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        window.location.assign("/admin/login?returnTo=%2Fadmin");
        return;
      }
      if (!response.ok) throw new Error("summary_unavailable");
      setDashboard(await response.json() as DashboardSummary);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!dashboard) {
      return [
        { label: "등록 사용자", value: "–", detail: "요약 불러오는 중" },
        ...(LIDL_ENABLED ? [
          { label: "활성 Lidl 쿠폰", value: "–", detail: "요약 불러오는 중" },
          { label: "오늘 QR 열람", value: "–", detail: "요약 불러오는 중" },
        ] : []),
        { label: "오늘 Dunnes 열람", value: "–", detail: "요약 불러오는 중" },
        { label: "오늘 Dunnes 사용", value: "–", detail: "요약 불러오는 중" },
        { label: "검수·위험", value: "–", detail: "요약 불러오는 중" },
      ];
    }

    const { summary, daily, dunnes_today: dunnesToday } = dashboard;
    const pendingCount = summary.pending_dunnes + summary.open_dunnes_reports
      + (LIDL_ENABLED ? summary.pending_lidl + summary.open_lidl_reports : 0);

    return [
      { label: "등록 사용자", value: summary.profiles, detail: LIDL_ENABLED ? `공유 카드 ${summary.shared_cards}개` : "Dunnes 중심 운영" },
      ...(LIDL_ENABLED ? [
        { label: "활성 Lidl 쿠폰", value: summary.active_coupons, detail: "사용 완료 제외" },
        { label: "오늘 QR 열람", value: daily.qr_views, detail: "사용자별 최대 3회" },
      ] : []),
      { label: "오늘 Dunnes 열람", value: dunnesToday.viewers, detail: `총 ${dunnesToday.views}회` },
      { label: "오늘 Dunnes 사용", value: dunnesToday.users, detail: `총 ${dunnesToday.uses}건` },
      { label: "검수·위험", value: pendingCount + summary.risk_users, detail: `위험 사용자 ${summary.risk_users}명` },
    ];
  }, [dashboard]);

  return (
    <>
      {state === "error" && (
        <p className="admin-data-warning" role="status">
          운영 요약을 불러오지 못했습니다. DB 연결을 다시 시도할 수 있습니다.{" "}
          <button className="admin-logout-button" type="button" onClick={() => void load()}>다시 조회</button>
        </p>
      )}
      <div className="admin-stats" aria-busy={state === "loading"}>
        {stats.map((stat) => (
          <article className="admin-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </article>
        ))}
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type ReservationRow = {
  voucher_id: string;
  voucher_label: string;
  membership_required: boolean;
  expires_on: string;
  reserved_until: string | null;
  needs_confirmation: boolean;
  owner_label: string;
  reserver_label: string;
};

const REFRESH_INTERVAL_MS = 10_000;

export default function AdminDunnesReservationStatus() {
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let disposed = false;

    async function refresh(initial = false) {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      if (initial) setLoading(true);

      try {
        const response = await fetch("/api/admin/dunnes-reservations", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("reservation_status_unavailable");
        const result = await response.json() as { reservations?: ReservationRow[] };
        if (disposed || controller.signal.aborted) return;
        setRows(result.reservations ?? []);
        setFailed(false);
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      } finally {
        if (!disposed && !controller.signal.aborted) setLoading(false);
      }
    }

    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };

    void refresh(true);
    const interval = window.setInterval(refreshVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      controllerRef.current?.abort();
    };
  }, []);

  return (
    <section className="admin-panel" id="dunnes-active-reservations" aria-busy={loading}>
      <header className="admin-panel-head">
        <div>
          <h2>현재 예약 중인 Dunnes 바우처</h2>
          <p className="admin-action-note">예약 중이거나, 바우처를 열어본 뒤 실제 사용 여부 확인을 기다리는 상태입니다. 10초마다 자동 갱신됩니다.</p>
        </div>
        <span>{loading ? "확인 중" : `${rows.length}건 예약 상태`}</span>
      </header>

      {failed && rows.length === 0 ? (
        <p className="admin-action-note">예약 상태를 불러오지 못했습니다. 잠시 후 자동으로 다시 확인합니다.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>바우처</th><th>상태</th><th>등록자</th><th>예약자</th><th>예약 시간</th></tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.voucher_id}>
                  <td><strong>{row.voucher_label}</strong><small className="admin-cell-note">쿠폰 만료 {row.expires_on}</small></td>
                  <td>
                    <span className={row.needs_confirmation ? "admin-table-status danger" : "admin-table-status warn"}>
                      {row.needs_confirmation ? "사용 확인 필요" : "예약 중"}
                    </span>
                    <small className="admin-cell-note">{row.membership_required ? "ValueClub 필요" : "멤버십 불필요"}</small>
                  </td>
                  <td>{row.owner_label}</td>
                  <td>{row.reserver_label}</td>
                  <td>{row.needs_confirmation ? "사용자 확인 대기" : row.reserved_until ?? "시간 확인 중"}</td>
                </tr>
              )) : <tr><td colSpan={5}>현재 예약 중인 Dunnes 바우처가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

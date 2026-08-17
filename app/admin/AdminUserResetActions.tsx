"use client";

import { useState } from "react";

type Voucher = {
  voucher_id: string;
  voucher_label: string;
  barcode: string;
  status: "available" | "reserved" | "used" | "expired" | "rejected";
  review_status: "pending" | "approved" | "rejected";
  expires_on: string;
};

type Props = {
  profileId: string;
  userLabel: string;
  registeredVouchers: number;
};

const statusLabel: Record<Voucher["status"], string> = {
  available: "사용 가능",
  reserved: "예약 중",
  used: "사용 완료",
  expired: "만료",
  rejected: "거절",
};

export default function AdminUserResetActions({ profileId, userLabel, registeredVouchers }: Props) {
  const [showVouchers, setShowVouchers] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  async function openVoucherManager() {
    setShowVouchers(true);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/user-vouchers?profileId=${encodeURIComponent(profileId)}`, { cache: "no-store" });
      const result = await response.json() as { vouchers?: Voucher[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "load_failed");
      setVouchers(result.vouchers ?? []);
    } catch {
      setError("바우처 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function resetVoucher(voucher: Voucher) {
    if (voucher.status === "reserved") return;
    if (!window.confirm(`${userLabel}\n${voucher.voucher_label}\n바코드 ${voucher.barcode}\n\n이 바우처를 초기화할까요? 삭제 후 같은 바코드를 다시 등록할 수 있습니다.`)) return;

    setResettingId(voucher.voucher_id);
    setError(null);
    try {
      const response = await fetch("/api/admin/user-vouchers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reset_voucher", voucherId: voucher.voucher_id }),
      });
      const result = await response.json().catch(() => ({ error: "reset_failed" })) as { error?: string };
      if (!response.ok) {
        if (result.error === "voucher_reserved") throw new Error("reserved");
        throw new Error(result.error ?? "reset_failed");
      }
      window.location.assign("/admin#user-controls");
    } catch (resetError) {
      setError(resetError instanceof Error && resetError.message === "reserved"
        ? "현재 예약 중인 바우처는 초기화할 수 없습니다. 예약이 끝난 뒤 다시 시도해 주세요."
        : "바우처를 초기화하지 못했습니다.");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <>
      <form className="admin-inline-actions" action="/api/admin/moderation" method="post">
        <input type="hidden" name="targetId" value={profileId} />
        <button name="action" value="reset_dunnes_reservations" type="submit" title="이 사용자의 오늘 Dunnes 예약 사용 횟수를 0으로 초기화합니다.">
          예약 초기화
        </button>
        <button name="action" value="reset_dunnes_upload_limit" type="submit" title="이 사용자의 오늘 Dunnes 바우처 등록 횟수를 0으로 초기화합니다.">
          등록 초기화
        </button>
        <button type="button" onClick={() => void openVoucherManager()} disabled={registeredVouchers <= 0}>
          바우처 {registeredVouchers}개 관리
        </button>
      </form>

      {showVouchers && (
        <div className="admin-voucher-modal-backdrop" role="presentation" onMouseDown={() => setShowVouchers(false)}>
          <section className="admin-voucher-modal" role="dialog" aria-modal="true" aria-labelledby={`voucher-manager-${profileId}`} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><small>DUNNES VOUCHERS</small><h2 id={`voucher-manager-${profileId}`}>{userLabel} · 바우처 초기화</h2></div>
              <button type="button" className="secondary" onClick={() => setShowVouchers(false)}>닫기</button>
            </header>
            <p>초기화할 바우처의 금액과 전체 바코드를 확인한 뒤 개별적으로 삭제하세요. 삭제된 바코드는 다시 등록할 수 있습니다.</p>
            {error && <div className="admin-voucher-modal-error" role="alert">{error}</div>}
            <div className="admin-voucher-list">
              {loading ? <p>불러오는 중…</p> : vouchers.length ? vouchers.map((voucher) => (
                <article className="admin-voucher-reset-row" key={voucher.voucher_id}>
                  <div>
                    <strong>{voucher.voucher_label}</strong>
                    <code>{voucher.barcode}</code>
                    <small>{statusLabel[voucher.status]} · {voucher.expires_on} 만료</small>
                  </div>
                  <button
                    type="button"
                    className="danger"
                    disabled={voucher.status === "reserved" || resettingId === voucher.voucher_id}
                    onClick={() => void resetVoucher(voucher)}
                    title={voucher.status === "reserved" ? "현재 예약 중인 바우처는 초기화할 수 없습니다." : "이 바우처만 삭제하고 동일 바코드의 재등록을 허용합니다."}
                  >
                    {voucher.status === "reserved" ? "예약 중" : resettingId === voucher.voucher_id ? "초기화 중…" : "이 바우처 초기화"}
                  </button>
                </article>
              )) : <p>등록된 Dunnes 바우처가 없습니다.</p>}
            </div>
          </section>
        </div>
      )}

      <style>{`
        #user-controls {
          display: flex;
          flex-direction: column;
          max-height: 430px;
          overflow: hidden;
        }
        #user-controls .admin-action-note {
          margin: 8px 18px 10px;
          font-size: 12px;
          line-height: 1.45;
        }
        #user-controls .admin-table-wrap {
          flex: 1 1 auto;
          max-height: 315px;
          overflow: auto;
          overscroll-behavior: contain;
        }
        #user-controls .admin-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #f5f8f5;
        }
        #user-controls .admin-table th,
        #user-controls .admin-table td {
          padding: 9px 10px;
          vertical-align: middle;
        }
        #user-controls .admin-cell-note {
          margin-top: 2px;
          font-size: 10px;
        }
        #user-controls .admin-inline-actions {
          gap: 5px;
          flex-wrap: nowrap;
        }
        #user-controls .admin-inline-actions button {
          min-height: 32px;
          padding: 6px 9px;
          font-size: 11px;
          white-space: nowrap;
        }
        .admin-voucher-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(8, 35, 24, .48);
          backdrop-filter: blur(4px);
        }
        .admin-voucher-modal {
          width: min(620px, 100%);
          max-height: min(720px, 88vh);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #d8e4db;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 24px 70px rgba(8, 35, 24, .25);
        }
        .admin-voucher-modal > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px 12px;
          border-bottom: 1px solid #edf2ee;
        }
        .admin-voucher-modal h2 {
          margin: 2px 0 0;
          font-size: 18px;
        }
        .admin-voucher-modal header small {
          color: #4d7964;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .14em;
        }
        .admin-voucher-modal > p {
          margin: 0;
          padding: 12px 20px;
          color: #5b6d64;
          font-size: 12px;
          line-height: 1.55;
          background: #fbfcfb;
        }
        .admin-voucher-list {
          min-height: 140px;
          overflow-y: auto;
          padding: 10px 12px 14px;
        }
        .admin-voucher-list > p {
          margin: 24px 8px;
          color: #6f7f77;
          text-align: center;
        }
        .admin-voucher-reset-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 11px 10px;
          border-bottom: 1px solid #edf2ee;
        }
        .admin-voucher-reset-row > div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .admin-voucher-reset-row strong {
          font-size: 14px;
        }
        .admin-voucher-reset-row code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .04em;
          overflow-wrap: anywhere;
        }
        .admin-voucher-reset-row small {
          color: #718079;
          font-size: 11px;
        }
        .admin-voucher-reset-row button {
          flex: 0 0 auto;
          min-height: 34px;
          padding: 7px 10px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 800;
        }
        .admin-voucher-modal-error {
          margin: 10px 20px 0;
          padding: 9px 11px;
          border: 1px solid #f0b4ad;
          border-radius: 10px;
          background: #fff3f1;
          color: #a43228;
          font-size: 12px;
        }
        @media (max-width: 720px) {
          #user-controls { max-height: 390px; }
          #user-controls .admin-table-wrap { max-height: 285px; }
          #user-controls .admin-inline-actions { flex-wrap: wrap; }
          .admin-voucher-modal-backdrop { padding: 10px; }
          .admin-voucher-reset-row { align-items: flex-start; flex-direction: column; }
          .admin-voucher-reset-row button { width: 100%; }
        }
      `}</style>
    </>
  );
}

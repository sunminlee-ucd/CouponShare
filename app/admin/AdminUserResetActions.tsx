"use client";

import { useState } from "react";
import styles from "./AdminUserResetActions.module.css";

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
      window.location.assign("/admin#admin-users");
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
        <div className={styles.backdrop} role="presentation" onMouseDown={() => setShowVouchers(false)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={`voucher-manager-${profileId}`} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <div><small>DUNNES VOUCHERS</small><h2 id={`voucher-manager-${profileId}`}>{userLabel} · 바우처 초기화</h2></div>
              <button type="button" className="secondary" onClick={() => setShowVouchers(false)}>닫기</button>
            </header>
            <p className={styles.description}>초기화할 바우처의 금액과 전체 바코드를 확인한 뒤 개별적으로 삭제하세요. 삭제된 바코드는 다시 등록할 수 있습니다.</p>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <div className={styles.list}>
              {loading ? <p className={styles.empty}>불러오는 중…</p> : vouchers.length ? vouchers.map((voucher) => (
                <article className={styles.voucherRow} key={voucher.voucher_id}>
                  <div className={styles.voucherInfo}>
                    <strong>{voucher.voucher_label}</strong>
                    <code>{voucher.barcode}</code>
                    <small>{statusLabel[voucher.status]} · {voucher.expires_on} 만료</small>
                  </div>
                  <button
                    type="button"
                    className={`danger ${styles.resetButton}`}
                    disabled={voucher.status === "reserved" || resettingId === voucher.voucher_id}
                    onClick={() => void resetVoucher(voucher)}
                    title={voucher.status === "reserved" ? "현재 예약 중인 바우처는 초기화할 수 없습니다." : "이 바우처만 삭제하고 동일 바코드의 재등록을 허용합니다."}
                  >
                    {voucher.status === "reserved" ? "예약 중" : resettingId === voucher.voucher_id ? "초기화 중…" : "이 바우처 초기화"}
                  </button>
                </article>
              )) : <p className={styles.empty}>등록된 Dunnes 바우처가 없습니다.</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

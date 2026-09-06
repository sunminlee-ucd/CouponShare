"use client";

import { useState } from "react";
import styles from "@/app/admin/DunnesManualReview.module.css";

type Props = {
  voucherId: string;
  voucherLabel: string;
  barcode: string;
  expiresOn: string;
  reviewStatus: "pending" | "approved";
  membershipRequired: boolean;
  hasMembershipImage: boolean;
};

export default function AdminDunnesPhotoReview({
  voucherId,
  voucherLabel,
  barcode,
  expiresOn,
  reviewStatus,
  membershipRequired,
  hasMembershipImage,
}: Props) {
  const [open, setOpen] = useState(false);
  const voucherImageUrl = `/api/admin/dunnes-voucher-image?voucherId=${encodeURIComponent(voucherId)}&kind=voucher`;
  const membershipImageUrl = `/api/admin/dunnes-voucher-image?voucherId=${encodeURIComponent(voucherId)}&kind=membership`;

  return (
    <div className={styles.control}>
      <button
        className={styles.photoButton}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "사진 닫기" : "사진·정보 확인"}
      </button>

      {open && (
        <div className={styles.photoPanel}>
          <div className={styles.checklist}>
            <strong>사후 검수</strong>
            <span>사진이 실제 Dunnes 할인쿠폰인지 확인하세요.</span>
            <span>종류: {voucherLabel}</span>
            <span>저장된 바코드: <code>{barcode}</code></span>
            <span>저장된 만료일: {expiresOn}</span>
            <span>만료일이 잘못되었다면 아래에서 수정하고, 사진이 유효하지 않거나 쿠폰 정보와 맞지 않으면 등록을 취소하세요.</span>
          </div>

          <div className={`${styles.photoGrid} ${membershipRequired ? styles.two : ""}`}>
            <figure>
              <figcaption>고객이 등록한 할인쿠폰 사진</figcaption>
              <img src={voucherImageUrl} alt={`${voucherLabel} 관리자 검수용 업로드 사진`} />
            </figure>
            {membershipRequired && (
              <figure>
                <figcaption>ValueClub Card 이미지</figcaption>
                {hasMembershipImage
                  ? <img src={membershipImageUrl} alt="관리자 검수용 ValueClub Card 이미지" />
                  : <p className={styles.imageWarning}>ValueClub 이미지가 저장되어 있지 않습니다. 등록 상태를 확인해 주세요.</p>}
              </figure>
            )}
          </div>

          <form className={styles.expiryForm} action="/api/admin/moderation" method="post">
            <input type="hidden" name="targetId" value={voucherId} />
            <label className={styles.expiryField}>
              <span>만료일 수정</span>
              <input type="date" name="expiresOn" defaultValue={expiresOn} required />
            </label>
            <button name="action" value="update_dunnes_expiry" type="submit">만료일 저장</button>
          </form>

          <form className={`admin-inline-actions ${styles.decisionActions}`} action="/api/admin/moderation" method="post">
            <input type="hidden" name="targetId" value={voucherId} />
            {reviewStatus === "pending" && (
              <>
                <input type="hidden" name="manualReviewConfirmed" value="photo_checked" />
                <button name="action" value="approve_dunnes" type="submit">사진 확인 후 승인</button>
              </>
            )}
            <button className="danger" name="action" value="reject_dunnes" type="submit">
              {reviewStatus === "approved" ? "등록 취소" : "거절"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

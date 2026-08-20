"use client";

import { useState } from "react";

type Props = {
  voucherId: string;
  voucherLabel: string;
  barcode: string;
  expiresOn: string;
  membershipRequired: boolean;
  hasMembershipImage: boolean;
};

export default function AdminDunnesPhotoReview({
  voucherId,
  voucherLabel,
  barcode,
  expiresOn,
  membershipRequired,
  hasMembershipImage,
}: Props) {
  const [open, setOpen] = useState(false);
  const voucherImageUrl = `/api/admin/dunnes-voucher-image?voucherId=${encodeURIComponent(voucherId)}&kind=voucher`;
  const membershipImageUrl = `/api/admin/dunnes-voucher-image?voucherId=${encodeURIComponent(voucherId)}&kind=membership`;

  return (
    <div className="admin-dunnes-review-control">
      <button
        className="admin-review-photo-button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "사진 닫기" : "사진 확인"}
      </button>

      {open && (
        <div className="admin-review-photo-panel">
          <div className="admin-review-checklist">
            <strong>직접 검수</strong>
            <span>사진이 실제 Dunnes 할인쿠폰인지 확인하세요.</span>
            <span>종류: {voucherLabel}</span>
            <span>저장된 바코드: <code>{barcode}</code></span>
            <span>저장된 만료일: {expiresOn}</span>
            <span>사진의 할인금액·구매조건·Valid 종료일·바코드 숫자가 위 정보와 모두 일치해야 승인합니다.</span>
          </div>

          <div className={membershipRequired ? "admin-review-photo-grid two" : "admin-review-photo-grid"}>
            <figure>
              <figcaption>고객이 등록한 할인쿠폰 사진</figcaption>
              <img src={voucherImageUrl} alt={`${voucherLabel} 관리자 검수용 업로드 사진`} />
            </figure>
            {membershipRequired && (
              <figure>
                <figcaption>ValueClub Card 이미지</figcaption>
                {hasMembershipImage
                  ? <img src={membershipImageUrl} alt="관리자 검수용 ValueClub Card 이미지" />
                  : <p className="admin-review-image-warning">ValueClub 이미지가 저장되어 있지 않습니다. 승인하지 말고 확인해 주세요.</p>}
              </figure>
            )}
          </div>

          <form className="admin-inline-actions admin-review-decision-actions" action="/api/admin/moderation" method="post">
            <input type="hidden" name="targetId" value={voucherId} />
            <input type="hidden" name="manualReviewConfirmed" value="photo_checked" />
            <button name="action" value="approve_dunnes" type="submit">사진 확인 후 승인</button>
            <button className="danger" name="action" value="reject_dunnes" type="submit">거절</button>
          </form>
        </div>
      )}
    </div>
  );
}

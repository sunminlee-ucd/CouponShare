"use client";

import { useEffect, useState } from "react";
import AdminDunnesPhotoReview from "@/app/admin/AdminDunnesPhotoReview";

type ReviewRow = {
  voucher_id: string;
  voucher_label: string;
  barcode: string;
  membership_required: boolean;
  has_membership_image: boolean;
  expires_on: string;
  updated_at: string;
};

export default function AdminDunnesReviewQueue() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/dunnes-review-queue", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("review queue unavailable");
        return await response.json() as { reviews?: ReviewRow[] };
      })
      .then((result) => {
        setReviews(result.reviews ?? []);
        setFailed(false);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <section className="admin-panel admin-manual-review-panel" aria-busy={loading}>
      <header className="admin-panel-head">
        <div>
          <h2>자동 승인 실패 · 직접 사진 검수</h2>
          <p className="admin-review-panel-copy">사진을 직접 확인한 뒤에만 승인할 수 있습니다.</p>
        </div>
        <span>{loading ? "불러오는 중" : `${reviews.length}건 대기`}</span>
      </header>

      {failed ? (
        <p className="admin-review-queue-message">검수 대기 이미지를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>
      ) : loading ? (
        <p className="admin-review-queue-message">검수 대기 목록을 불러오는 중입니다.</p>
      ) : reviews.length === 0 ? (
        <p className="admin-review-queue-message">현재 직접 확인할 Dunnes 바우처가 없습니다.</p>
      ) : (
        <div className="admin-manual-review-list">
          {reviews.map((review) => (
            <article className="admin-manual-review-item" key={review.voucher_id}>
              <div className="admin-manual-review-summary">
                <div>
                  <strong>{review.voucher_label}</strong>
                  <span>{review.membership_required ? "ValueClub 확인 필요" : "ValueClub 불필요"}</span>
                </div>
                <div>
                  <span>만료 {review.expires_on}</span>
                  <small>{review.updated_at}</small>
                </div>
              </div>
              <AdminDunnesPhotoReview
                voucherId={review.voucher_id}
                voucherLabel={review.voucher_label}
                barcode={review.barcode}
                expiresOn={review.expires_on}
                membershipRequired={review.membership_required}
                hasMembershipImage={review.has_membership_image}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

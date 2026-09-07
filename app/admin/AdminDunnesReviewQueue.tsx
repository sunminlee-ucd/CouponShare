"use client";

import { useEffect, useRef, useState } from "react";
import AdminDunnesPhotoReview from "@/app/admin/AdminDunnesPhotoReview";
import styles from "@/app/admin/DunnesManualReview.module.css";

type ReviewRow = {
  voucher_id: string;
  voucher_label: string;
  barcode: string;
  membership_required: boolean;
  has_membership_image: boolean;
  expires_on: string;
  review_status: "pending" | "approved";
  status: "available" | "reserved";
  usage_confirmation_pending: boolean;
  owner_profile_id: string;
  owner_auth_user_id: string | null;
  owner_email: string | null;
  owner_provider: string | null;
  updated_at: string;
};

const REVIEW_REFRESH_INTERVAL_MS = 10_000;

function providerLabel(provider: string | null) {
  const normalized = (provider ?? "profile").toLowerCase();
  if (normalized === "google") return "Google";
  if (normalized === "email") return "Email";
  if (normalized === "profile") return "Profile";
  return provider || "Profile";
}

function ownerLabel(review: ReviewRow) {
  if (review.owner_email) return review.owner_email;
  return `프로필 ${review.owner_profile_id.slice(0, 8)}`;
}

export default function AdminDunnesReviewQueue() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => {
    let disposed = false;

    const refresh = async (showInitialLoading = false) => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      if (showInitialLoading) setLoading(true);

      try {
        const response = await fetch("/api/admin/dunnes-review-queue", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("review queue unavailable");
        const result = await response.json() as { reviews?: ReviewRow[] };
        if (disposed || controller.signal.aborted) return;
        setReviews(result.reviews ?? []);
        setFailed(false);
        setLastUpdatedAt(new Date());
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      } finally {
        if (!disposed && !controller.signal.aborted) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };

    void refresh(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, REVIEW_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      activeController.current?.abort();
    };
  }, []);

  const refreshStatus = loading
    ? "불러오는 중"
    : `${reviews.length}건 등록 중 · 10초 자동 갱신${lastUpdatedAt ? ` · ${lastUpdatedAt.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}`;

  return (
    <section className="admin-panel" aria-busy={loading}>
      <header className="admin-panel-head">
        <div>
          <h2>현재 등록된 Dunnes 바우처</h2>
          <p className={styles.panelCopy}>현재 나눔·예약·사용확인 대기 상태의 바우처와 등록 계정을 함께 표시합니다. 필요하면 사진과 만료일을 확인하고 등록을 취소할 수 있습니다.</p>
        </div>
        <span>{refreshStatus}</span>
      </header>

      {failed && reviews.length === 0 ? (
        <p className={styles.queueMessage}>등록된 바우처를 불러오지 못했습니다. 화면으로 돌아오면 자동으로 다시 시도합니다.</p>
      ) : loading ? (
        <p className={styles.queueMessage}>등록 바우처 목록을 불러오는 중입니다.</p>
      ) : reviews.length === 0 ? (
        <p className={styles.queueMessage}>현재 등록 중인 Dunnes 바우처가 없습니다.</p>
      ) : (
        <div className={styles.list}>
          {reviews.map((review) => (
            <article className={styles.item} key={review.voucher_id}>
              <div className={styles.summary}>
                <div>
                  <strong>{review.voucher_label} · ••••{review.barcode.slice(-4)}</strong>
                  <span>
                    {review.review_status === "approved" ? "자동 승인됨" : "수동 승인 대기"}
                    {review.usage_confirmation_pending ? " · 사용완료 확인 대기" : review.status === "reserved" ? " · 예약 중" : " · 나눔 중"}
                    {review.membership_required ? " · ValueClub 확인 필요" : " · ValueClub 불필요"}
                  </span>
                  <small>등록 계정 {ownerLabel(review)} · {providerLabel(review.owner_provider)}</small>
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
                reviewStatus={review.review_status}
                usageConfirmationPending={review.usage_confirmation_pending}
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

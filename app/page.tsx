"use client";

import { ChangeEvent, useMemo, useState } from "react";

const members = [
  { name: "선민", initial: "선", coupons: 5, saving: 4.1, shared: false },
  { name: "지민", initial: "지", coupons: 8, saving: 8.2, shared: true },
  { name: "현우", initial: "현", coupons: 3, saving: 2.75, shared: true },
];

export default function Home() {
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [wholeBasket, setWholeBasket] = useState(true);

  const totalCoupons = useMemo(
    () => members.reduce((sum, member) => sum + member.coupons, 0),
    [],
  );

  function handleQrUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (qrPreview) URL.revokeObjectURL(qrPreview);
    setQrPreview(URL.createObjectURL(file));
    setSharing(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="CouponShare 홈">
          <span className="brand-mark">C</span>
          <span>CouponShare</span>
        </a>
        <button className="profile-button" type="button" aria-label="내 프로필">
          선
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">DUBLIN · CLOSED GROUP</p>
          <h1>
            이번 장보기,
            <br />
            <span>누구의 쿠폰이 좋을까요?</span>
          </h1>
          <p className="hero-description">
            그룹이 공유한 활성 쿠폰을 비교하고, 가장 많이 절약되는 Lidl Plus
            카드를 한 번에 선택하세요.
          </p>
        </div>

        <div className="saving-card" aria-label="이번 달 절약 요약">
          <span>우리 그룹 이번 달 절약</span>
          <strong>€34.60</strong>
          <div className="saving-meta">
            <span>{members.length}명 참여</span>
            <span>{totalCoupons}개 쿠폰</span>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="main-column">
          <section className="panel recommendation-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">BEST MATCH</p>
                <h2>지민님의 카드가 가장 좋아요</h2>
              </div>
              <span className="status-pill">공유 중</span>
            </div>

            <div className="recommendation-body">
              <div className="member-avatar large">지</div>
              <div className="recommendation-detail">
                <span>예상 할인</span>
                <strong>€8.20</strong>
                <p>장바구니 7개 상품 중 4개에 쿠폰 적용</p>
              </div>
            </div>

            <div className="points-note">
              <span className="info-dot">i</span>
              <p>
                이 쇼핑에서 적립되는 Lidl Points와 구매내역은 지민님의 계정에
                귀속됩니다.
              </p>
            </div>

            <label className="basket-rule">
              <input
                type="checkbox"
                checked={wholeBasket}
                onChange={(event) => setWholeBasket(event.target.checked)}
              />
              <span>
                <strong>한 장바구니에는 한 카드만 사용</strong>
                <small>그룹의 공정한 이용 약속에 동의합니다.</small>
              </span>
            </label>

            <button
              className="primary-button"
              type="button"
              disabled={!wholeBasket}
              onClick={() => setShowQr(true)}
            >
              지민님의 QR 열기
              <span aria-hidden="true">→</span>
            </button>
          </section>

          <section className="panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">GROUP WALLET</p>
                <h2>공유 중인 카드</h2>
              </div>
              <button className="text-button" type="button">
                그룹 관리
              </button>
            </div>

            <div className="member-list">
              {members.map((member) => (
                <article className="member-row" key={member.name}>
                  <div className="member-avatar">{member.initial}</div>
                  <div className="member-name">
                    <strong>{member.name}</strong>
                    <span>{member.coupons}개 쿠폰 활성화</span>
                  </div>
                  <div className="member-saving">
                    <span>최대</span>
                    <strong>€{member.saving.toFixed(2)}</strong>
                  </div>
                  <span className={member.shared ? "share-dot on" : "share-dot"}>
                    {member.shared ? "공유" : "비공개"}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel upload-panel">
            <p className="eyebrow">MY LIDL PLUS</p>
            <h2>내 QR 등록</h2>
            <p className="muted">
              QR 소유자가 직접 올리고, 허용한 그룹 멤버에게만 공개합니다.
            </p>

            <label className={qrPreview ? "upload-box has-image" : "upload-box"}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleQrUpload}
              />
              {qrPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrPreview} alt="업로드한 QR 미리보기" />
              ) : (
                <>
                  <span className="upload-icon" aria-hidden="true">＋</span>
                  <strong>QR 이미지 선택</strong>
                  <small>PNG, JPG 또는 WebP</small>
                </>
              )}
            </label>

            {qrPreview && (
              <label className="share-toggle">
                <span>
                  <strong>그룹에 공유</strong>
                  <small>{sharing ? "멤버가 열람할 수 있어요" : "나만 볼 수 있어요"}</small>
                </span>
                <input
                  type="checkbox"
                  checked={sharing}
                  onChange={(event) => setSharing(event.target.checked)}
                />
              </label>
            )}

            <p className="prototype-note">
              개발 미리보기에서는 이미지가 서버에 저장되지 않습니다.
            </p>
          </section>

          <section className="panel trust-panel">
            <span className="lock-mark" aria-hidden="true">●</span>
            <div>
              <h3>신뢰하는 사람끼리만</h3>
              <p>
                초대받은 멤버만 참여하고, QR 소유자는 공유를 언제든 철회할 수
                있습니다. 화면 캡처까지 기술적으로 막을 수는 없습니다.
              </p>
            </div>
          </section>
        </aside>
      </section>

      <footer>
        <span>© 2026 Sunmin Lee. All rights reserved.</span>
        <span>CouponShare is not affiliated with or endorsed by Lidl.</span>
      </footer>

      {showQr && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowQr(false)}>
          <section
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setShowQr(false)} aria-label="닫기">
              ×
            </button>
            <p className="eyebrow">SHARED WITH YOUR GROUP</p>
            <h2 id="qr-title">지민님의 Lidl Plus QR</h2>
            <div className="qr-placeholder" aria-label="QR 코드 자리 표시자">
              <span>QR</span>
            </div>
            <p className="modal-warning">
              이 코드는 이번 장바구니 전체에 한 번만 사용하세요. 열람 기록은 QR
              소유자에게 표시됩니다.
            </p>
            <button className="primary-button" type="button" onClick={() => setShowQr(false)}>
              사용 완료
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

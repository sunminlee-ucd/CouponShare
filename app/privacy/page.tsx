import Link from "next/link";
import PolicyLinks from "@/app/PolicyLinks";

export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <main className="policy-shell">
      <Link className="brand" href="/access"><span className="brand-mark">C</span><span>CouponShare</span></Link>
      <article className="policy-document">
        <p className="eyebrow">PRIVACY NOTICE · 16 AUG 2026</p>
        <h1>개인정보처리방침</h1>
        <p>CouponShare는 아일랜드 비공개 테스트 참여자의 쿠폰 공유 기능을 제공하기 위해 필요한 정보만 처리합니다.</p>
        <h2>처리하는 정보</h2>
        <ul>
          <li>무작위 기기 식별자와 서비스 이용·제한 기록</li>
          <li>사용자가 직접 등록한 Lidl QR, Dunnes 바우처와 ValueClub 카드 이미지</li>
          <li>활성 쿠폰, 만료일, 예약·사용·절약 금액 기록</li>
          <li>관리 목적의 차단·검수 기록</li>
          <li>사용자가 직접 작성한 오류 신고 내용과 신고가 발생한 화면</li>
        </ul>
        <h2>목적과 법적 근거</h2>
        <p>비공개 쿠폰 공유, 중복·악용 방지, 사용 내역 제공을 위해 이용자의 명시적 동의에 근거해 처리합니다. 동의하지 않으면 서비스를 이용하지 않아도 됩니다.</p>
        <h2>저장 위치와 제공업체</h2>
        <p>서비스는 Google Cloud Run 유럽 리전과 Supabase PostgreSQL 유럽 리전을 사용합니다. 영수증 사진은 브라우저에서 분석하며 서버에 저장하지 않습니다.</p>
        <h2>보관과 삭제</h2>
        <p>쿠폰은 만료 또는 사용 완료 시 비활성화·삭제됩니다. QR 공유를 중지하면 다른 참여자에게 더 이상 제공되지 않습니다. 이용자는 내 정보 관리에서 자신의 프로필과 연결 데이터를 즉시 삭제할 수 있습니다.</p>
        <h2>권리</h2>
        <p>이용자는 자신의 데이터 열람·다운로드·정정·삭제·처리 제한을 요청할 수 있으며, 아일랜드 Data Protection Commission에 민원을 제기할 수 있습니다.</p>
        <h2>문의</h2>
        <p>{contact ? <a href={`mailto:${contact}`}>{contact}</a> : "비공개 테스트 초대코드를 전달한 운영자에게 문의해 주세요."}</p>
      </article>
      <PolicyLinks settings={false} />
    </main>
  );
}

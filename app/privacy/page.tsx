import Link from "next/link";
import PolicyLinks from "@/app/PolicyLinks";
import { LocalizedText } from "@/app/i18n";

export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <main className="policy-shell">
      <Link className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></Link>
      <article className="policy-document">
        <p className="eyebrow">PRIVACY NOTICE · 18 AUG 2026</p>
        <h1><LocalizedText text="개인정보처리방침" /></h1>
        <p><LocalizedText text="CouponShare는 계정 로그인과 Dunnes 바우처 공유 기능을 제공하기 위해 필요한 정보만 처리합니다. 로그인 없이 둘러보는 경우에는 바우처를 조회할 수 있지만 계정용 활동 프로필을 새로 만들지 않습니다." /></p>
        <h2><LocalizedText text="처리하는 정보" /></h2>
        <ul>
          <li><LocalizedText text="회원가입 및 로그인에 사용하는 이메일 주소와 로그인 제공 방식(이메일 또는 Google)" /></li>
          <li><LocalizedText text="사용자가 직접 등록한 Dunnes 바우처 이미지와 필요한 경우 ValueClub 카드 이미지" /></li>
          <li><LocalizedText text="바우처 만료일, 예약·사용 기록과 서비스 이용 제한 기록" /></li>
          <li><LocalizedText text="관리 목적의 차단·검수 기록" /></li>
          <li><LocalizedText text="로그인 사용자가 직접 작성한 오류 신고 내용과 신고가 발생한 화면" /></li>
        </ul>
        <h2><LocalizedText text="현재 비활성 기능" /></h2>
        <p><LocalizedText text="저장소에는 향후 검토를 위한 Lidl 기능 구현이 포함되어 있지만 현재 운영 환경에서는 비활성화되어 있으며 Lidl 지갑 API는 제공하지 않습니다." /></p>
        <h2><LocalizedText text="목적" /></h2>
        <p><LocalizedText text="바우처 공유와 예약, 중복·악용 방지, 사용 내역 제공, 오류 대응을 위해 정보를 처리합니다. 둘러보기 모드를 선택하면 쓰기 기능은 사용할 수 없습니다." /></p>
        <h2><LocalizedText text="저장 위치와 제공업체" /></h2>
        <p><LocalizedText text="서비스 애플리케이션은 Google Cloud Run 유럽 리전에서 실행되며 계정 인증과 PostgreSQL 데이터 저장에는 Supabase의 유럽 리전을 사용합니다." /></p>
        <h2><LocalizedText text="보관과 삭제" /></h2>
        <p><LocalizedText text="만료된 Dunnes 바우처는 서비스 정리 과정에서 삭제됩니다. 로그인 사용자는 내 정보 관리에서 자신의 계정 데이터를 내려받을 수 있고 CouponShare 계정과 연결 데이터를 삭제할 수 있습니다." /></p>
        <h2><LocalizedText text="권리" /></h2>
        <p><LocalizedText text="이용자는 자신의 데이터 열람·다운로드·정정·삭제·처리 제한을 요청할 수 있으며, 관련 법률에 따른 권리를 행사할 수 있습니다." /></p>
        <h2><LocalizedText text="문의" /></h2>
        <p>{contact ? <a href={`mailto:${contact}`}>{contact}</a> : <LocalizedText text="CouponShare 서비스 운영자에게 문의해 주세요." />}</p>
      </article>
      <PolicyLinks settings={false} />
    </main>
  );
}

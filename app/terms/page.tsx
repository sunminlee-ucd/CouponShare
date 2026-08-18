import Link from "next/link";
import PolicyLinks from "@/app/PolicyLinks";
import { LocalizedText } from "@/app/i18n";

export default function TermsPage() {
  return (
    <main className="policy-shell">
      <Link className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></Link>
      <article className="policy-document">
        <p className="eyebrow">SERVICE TERMS · 18 AUG 2026</p>
        <h1><LocalizedText text="이용약관" /></h1>
        <h2><LocalizedText text="계정과 둘러보기" /></h2>
        <p><LocalizedText text="CouponShare는 이메일 또는 Google 계정으로 로그인할 수 있습니다. 로그인 없이 둘러보기 모드를 선택하면 공개된 바우처 목록을 조회할 수 있지만 등록, 예약, 오류 신고 등 데이터를 변경하는 기능은 사용할 수 없습니다." /></p>
        <h2><LocalizedText text="사용자 책임" /></h2>
        <ul>
          <li><LocalizedText text="본인이 사용할 권한이 있는 Dunnes 바우처와 필요한 ValueClub 정보만 등록합니다." /></li>
          <li><LocalizedText text="바우처를 판매하거나 대가를 요구하지 않습니다." /></li>
          <li><LocalizedText text="예약한 바우처는 정해진 시간 안에 사용하거나 필요하지 않으면 즉시 취소합니다." /></li>
          <li><LocalizedText text="Dunnes Stores의 최신 바우처 약관과 매장 정책을 직접 확인하고 준수합니다." /></li>
        </ul>
        <h2><LocalizedText text="제한과 책임" /></h2>
        <p><LocalizedText text="바우처의 실제 사용 가능 여부와 할인 적용은 판매자가 결정합니다. CouponShare는 특정 바우처의 승인, 할인 적용 또는 외부 서비스의 지속적인 이용 가능성을 보증하지 않습니다." /></p>
        <h2><LocalizedText text="금지 행위" /></h2>
        <p><LocalizedText text="자동화된 대량 요청, 사용 제한 우회, 타인의 계정 또는 바우처 도용, 중복 등록, 악성 이미지 업로드가 확인되면 계정을 차단하고 관련 데이터를 삭제할 수 있습니다." /></p>
        <h2><LocalizedText text="현재 비활성 기능" /></h2>
        <p><LocalizedText text="저장소에 포함된 Lidl 관련 구현은 현재 운영 환경에서 비활성화되어 있으며 현재 서비스 기능으로 제공되지 않습니다." /></p>
        <h2><LocalizedText text="서비스 관계" /></h2>
        <p><LocalizedText text="CouponShare는 Dunnes Stores 또는 Lidl과 제휴하거나 보증받은 서비스가 아닙니다. 상표와 서비스 명칭은 각 권리자에게 귀속됩니다." /></p>
      </article>
      <PolicyLinks settings={false} />
    </main>
  );
}

import Link from "next/link";
import PolicyLinks from "@/app/PolicyLinks";
import { LocalizedText } from "@/app/i18n";

export default function TermsPage() {
  return (
    <main className="policy-shell">
      <Link className="brand" href="/access"><span className="brand-mark">C</span><span>CouponShare</span></Link>
      <article className="policy-document">
        <p className="eyebrow">PRIVATE TEST TERMS · 14 AUG 2026</p>
        <h1><LocalizedText text="테스트 이용약관" /></h1>
        <h2><LocalizedText text="비공개 테스트" /></h2>
        <p><LocalizedText text="CouponShare는 초대받은 성인 이용자를 위한 비상업적 테스트 서비스입니다. 초대코드를 공개 게시하거나 불특정 다수에게 전달하면 안 됩니다." /></p>
        <h2><LocalizedText text="사용자 책임" /></h2>
        <ul>
          <li><LocalizedText text="본인이 사용할 권한이 있는 QR·바우처만 등록합니다." /></li>
          <li><LocalizedText text="바우처를 판매하거나 대가를 요구하지 않습니다." /></li>
          <li><LocalizedText text="예약한 바우처는 정해진 시간 안에 사용하거나 즉시 취소합니다." /></li>
          <li><LocalizedText text="Lidl Plus와 Dunnes VALUEclub의 최신 약관 및 매장 정책을 직접 준수합니다." /></li>
        </ul>
        <h2><LocalizedText text="제한과 책임" /></h2>
        <p><LocalizedText text="QR·바우처의 사용 가능 여부와 할인 적용은 해당 판매자가 결정합니다. CouponShare는 할인 적용, 계정 상태 또는 서비스 중단을 보증하지 않습니다." /></p>
        <h2><LocalizedText text="금지 행위" /></h2>
        <p><LocalizedText text="자동화된 대량 요청, 제한 우회, 타인의 정보 도용, 중복 등록, 악성 이미지 업로드가 확인되면 접근을 차단하고 관련 데이터를 삭제할 수 있습니다." /></p>
        <h2><LocalizedText text="서비스 관계" /></h2>
        <p><LocalizedText text="CouponShare는 Lidl 또는 Dunnes Stores와 제휴하거나 보증받은 서비스가 아닙니다. 상표와 서비스 명칭은 각 권리자에게 귀속됩니다." /></p>
      </article>
      <PolicyLinks settings={false} />
    </main>
  );
}

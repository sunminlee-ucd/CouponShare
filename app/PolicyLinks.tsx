import Link from "next/link";

export default function PolicyLinks({ settings = true }: { settings?: boolean }) {
  return (
    <footer className="policy-footer">
      <span>© 2026 Sunmin Lee. All rights reserved.</span>
      <nav aria-label="정책 및 계정">
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/terms">이용약관</Link>
        {settings && <Link href="/settings">내 정보 관리</Link>}
      </nav>
      <span>CouponShare는 Lidl 또는 Dunnes Stores와 제휴하거나 보증받은 서비스가 아닙니다.</span>
    </footer>
  );
}

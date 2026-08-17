"use client";

import Link from "next/link";
import { useLanguage } from "./i18n";

export default function PolicyLinks({ settings = true }: { settings?: boolean }) {
  const { t } = useLanguage();
  return (
    <footer className="policy-footer">
      <span>{t("© 2026 Sunmin Lee. All rights reserved.")}</span>
      <nav aria-label={t("정책 및 계정")}>
        <Link href="/privacy">{t("개인정보처리방침")}</Link>
        <Link href="/terms">{t("이용약관")}</Link>
        {settings && <Link href="/settings">{t("내 정보 관리")}</Link>}
      </nav>
      <span>{t("CouponShare는 Lidl 또는 Dunnes Stores와 제휴하거나 보증받은 서비스가 아닙니다. 상표와 서비스 명칭은 각 권리자에게 귀속됩니다.")}</span>
    </footer>
  );
}

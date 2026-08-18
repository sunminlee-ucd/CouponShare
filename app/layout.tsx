import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./attention-pulse.css";
import { LanguageProvider, LanguageSwitcher } from "./i18n";
import AuthStatusControl from "./AuthStatusControl";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "CouponShare — 함께 더 알뜰한 장보기";
  const description = "신뢰하는 그룹과 활성 쿠폰을 비교하고 가장 좋은 카드를 선택하세요.";

  return {
    title,
    description,
    applicationName: "CouponShare",
    manifest: "/manifest-v2.json",
    icons: {
      icon: [{ url: "/couponshare-icon-192-v2.png", sizes: "192x192", type: "image/png" }, { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
      shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
      apple: [{ url: "/couponshare-apple-touch-v2.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "CouponShare",
    },
    openGraph: {
      title,
      description,
      images: [{ url: `${origin}/og.png`, width: 1728, height: 907 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#19734c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><LanguageProvider><LanguageSwitcher /><AuthStatusControl />{children}</LanguageProvider></body>
    </html>
  );
}

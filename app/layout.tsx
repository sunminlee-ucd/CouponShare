import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./attention-pulse.css";
import "./button-press-feedback.css";
import "./home-install-guide.css";
import { LanguageProvider } from "./i18n";
import AppSidebar from "./AppSidebar";
import HomeInstallGuide from "./HomeInstallGuide";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "CouponShare — Dunnes 쿠폰 무료 나눔";
  const description = "사용하지 않는 Dunnes 쿠폰을 나눔하세요. 만료 전에 공유하고 새 쿠폰을 다시 받아보세요.";
  const socialImage = `${origin}/og.png`;

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
      siteName: "CouponShare",
      images: [{ url: socialImage, width: 320, height: 168, type: "image/png", alt: "CouponShare — 사용하지 않는 Dunnes 쿠폰 나눔" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#19734c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><LanguageProvider><AppSidebar />{children}<HomeInstallGuide /></LanguageProvider></body>
    </html>
  );
}

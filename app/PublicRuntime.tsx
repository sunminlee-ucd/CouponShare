"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const AppActivityTracker = lazy(() => import("./AppActivityTracker"));
const AppSidebar = lazy(() => import("./AppSidebar"));
const DunnesMembershipGuard = lazy(() => import("./DunnesMembershipGuard"));
const GoogleOAuthNavigationGuard = lazy(() => import("./GoogleOAuthNavigationGuard"));
const HomeInstallGuide = lazy(() => import("./HomeInstallGuide"));
const LoginLanguageSwitcher = lazy(() => import("./LoginLanguageSwitcher"));
const MaintenancePageGuard = lazy(() => import("./MaintenancePageGuard"));
const MyVoucherReservationStatus = lazy(() => import("./MyVoucherReservationStatus"));
const NotificationCenter = lazy(() => import("./NotificationCenter"));
const OwnerVoucherNotification = lazy(() => import("./OwnerVoucherNotification"));
const PublicVoucherReservationStatus = lazy(() => import("./PublicVoucherReservationStatus"));
const TodayUsedVouchersPanel = lazy(() => import("./TodayUsedVouchersPanel"));

const BACKGROUND_START_DELAY_MS = 1_200;

export default function PublicRuntime() {
  const pathname = usePathname();
  const [backgroundReady, setBackgroundReady] = useState(false);

  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/login";
  const isHome = pathname === "/";
  const isDunnes = pathname === "/dunnes" || pathname.startsWith("/dunnes/");
  const isLidlImport = pathname.startsWith("/lidl-import");
  const showAppChrome = isHome || isDunnes || isLidlImport;

  useEffect(() => {
    setBackgroundReady(false);
    if (isAdmin || isLogin || pathname.startsWith("/auth")) return;
    const timer = window.setTimeout(() => setBackgroundReady(true), BACKGROUND_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isAdmin, isLogin, pathname]);

  if (isAdmin) return null;

  return (
    <Suspense fallback={null}>
      <MaintenancePageGuard />
      {showAppChrome && <AppSidebar />}
      {isHome && <HomeInstallGuide />}
      {isLogin && <GoogleOAuthNavigationGuard />}
      {isLogin && <LoginLanguageSwitcher />}

      {backgroundReady && <AppActivityTracker />}
      {backgroundReady && showAppChrome && <NotificationCenter />}
      {backgroundReady && isDunnes && <TodayUsedVouchersPanel />}
      {backgroundReady && isDunnes && <DunnesMembershipGuard />}
      {backgroundReady && isDunnes && <MyVoucherReservationStatus />}
      {backgroundReady && isDunnes && <PublicVoucherReservationStatus />}
      {backgroundReady && isDunnes && <OwnerVoucherNotification />}
    </Suspense>
  );
}

"use client";

import { lazy, Suspense } from "react";
import { usePathname } from "next/navigation";

const AppActivityTracker = lazy(() => import("./AppActivityTracker"));
const AppSidebar = lazy(() => import("./AppSidebar"));
const DunnesMembershipGuard = lazy(() => import("./DunnesMembershipGuard"));
const GoogleOAuthNavigationGuard = lazy(() => import("./GoogleOAuthNavigationGuard"));
const HomeInstallGuide = lazy(() => import("./HomeInstallGuide"));
const LoginLanguageSwitcher = lazy(() => import("./LoginLanguageSwitcher"));
const MyVoucherReservationStatus = lazy(() => import("./MyVoucherReservationStatus"));
const NotificationCenter = lazy(() => import("./NotificationCenter"));
const OwnerVoucherNotification = lazy(() => import("./OwnerVoucherNotification"));
const PublicVoucherReservationStatus = lazy(() => import("./PublicVoucherReservationStatus"));
const TodayUsedVouchersPanel = lazy(() => import("./TodayUsedVouchersPanel"));

export default function PublicRuntime() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <Suspense fallback={null}>
      <AppSidebar />
      <NotificationCenter />
      <AppActivityTracker />
      <TodayUsedVouchersPanel />
      <DunnesMembershipGuard />
      <MyVoucherReservationStatus />
      <PublicVoucherReservationStatus />
      <OwnerVoucherNotification />
      <GoogleOAuthNavigationGuard />
      <HomeInstallGuide />
      <LoginLanguageSwitcher />
    </Suspense>
  );
}

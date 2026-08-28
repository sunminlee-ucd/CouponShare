import type { ReactNode } from "react";
import DunnesBarcodeEnhancer from "./DunnesBarcodeEnhancer";
import DunnesGuestActionGuard from "./DunnesGuestActionGuard";
import DunnesUsageGuide from "./DunnesUsageGuide";

export default function DunnesLayout({ children }: { children: ReactNode }) {
  return <><DunnesBarcodeEnhancer /><DunnesGuestActionGuard /><DunnesUsageGuide />{children}</>;
}

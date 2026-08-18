import type { ReactNode } from "react";
import DunnesBarcodeEnhancer from "./DunnesBarcodeEnhancer";
import DunnesGuestActionGuard from "./DunnesGuestActionGuard";

export default function DunnesLayout({ children }: { children: ReactNode }) {
  return <><DunnesBarcodeEnhancer /><DunnesGuestActionGuard />{children}</>;
}

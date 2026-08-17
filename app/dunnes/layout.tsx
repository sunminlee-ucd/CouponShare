import type { ReactNode } from "react";
import DunnesBarcodeEnhancer from "./DunnesBarcodeEnhancer";

export default function DunnesLayout({ children }: { children: ReactNode }) {
  return <><DunnesBarcodeEnhancer />{children}</>;
}

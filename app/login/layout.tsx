import type { ReactNode } from "react";
import styles from "./login-logo.module.css";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className={styles.scope}>{children}</div>;
}

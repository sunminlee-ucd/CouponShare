"use client";

import { useEffect } from "react";

export default function AdminSessionRefresh() {
  useEffect(() => {
    void fetch("/api/admin/refresh", { method: "POST", credentials: "include" });
  }, []);
  return null;
}

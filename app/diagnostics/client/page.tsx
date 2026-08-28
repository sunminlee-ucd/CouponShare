"use client";

import { useEffect, useState } from "react";

export default function ClientDiagnosticsPage() {
  const [phase, setPhase] = useState("server-rendered");
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    setPhase("hydrated");
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "48px auto", padding: 24 }}>
      <h1>CouponShare client diagnostics</h1>
      <p data-testid="client-phase">{phase}</p>
      <button type="button" onClick={() => setClicks((value) => value + 1)}>Increment</button>
      <output data-testid="click-count" style={{ display: "block", marginTop: 12 }}>{clicks}</output>
    </main>
  );
}

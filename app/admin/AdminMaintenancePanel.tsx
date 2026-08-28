"use client";

import { useEffect, useState } from "react";

const TEST_ACCOUNTS = [
  "leesunmin7212@gmail.com",
  "atena.zahiri73@gmail.com",
] as const;

type MaintenanceResponse = {
  enabled?: boolean;
  durationMinutes?: number;
  startedAt?: string | null;
  recoveryAt?: string | null;
};

const COPY = {
  eyebrow: "SERVICE ACCESS",
  title: "\uC11C\uBC84 \uC810\uAC80 \uBAA8\uB4DC",
  body: "\uD65C\uC131\uD654\uD558\uBA74 \uC77C\uBC18 \uC0AC\uC6A9\uC790\uC758 \uC571 \uBC0F \uB85C\uADF8\uC778 \uC811\uADFC\uC744 \uC7A0\uC2DC \uB9C9\uACE0 \uC810\uAC80 \uC548\uB0B4 \uD654\uBA74\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  adminSafe: "Admin \uACBD\uB85C\uC640 Admin API\uB294 \uC810\uAC80 \uC911\uC5D0\uB3C4 \uACC4\uC18D \uC811\uADFC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  statusOn: "\uD604\uC7AC \uC810\uAC80 \uBAA8\uB4DC ON",
  statusOff: "\uD604\uC7AC \uC810\uAC80 \uBAA8\uB4DC OFF",
  turnOn: "\uC810\uAC80 \uBAA8\uB4DC \uCF1C\uAE30",
  turnOff: "\uC810\uAC80 \uBAA8\uB4DC \uC885\uB8CC",
  saving: "\uC801\uC6A9 \uC911...",
  loading: "\uC0C1\uD0DC \uD655\uC778 \uC911...",
  error: "\uC810\uAC80 \uBAA8\uB4DC \uC0C1\uD0DC\uB97C \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
  invalidDuration: "1~1440\uBD84 \uC0AC\uC774\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.",
  confirmOn: "\uC77C\uBC18 \uC0AC\uC6A9\uC790\uC758 \uC811\uADFC\uC744 \uC989\uC2DC \uC810\uAC80 \uD654\uBA74\uB85C \uC804\uD658\uD560\uAE4C\uC694? Admin \uC811\uADFC\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.",
  durationLabel: "\uC608\uC0C1 \uC810\uAC80 \uC2DC\uAC04",
  durationHint: "\uBD84 \uB2E8\uC704\uB85C \uC785\uB825\uD558\uC138\uC694. \uC608: 30, 90",
  durationUnit: "\uBD84",
  saveEstimate: "\uC608\uC0C1 \uC2DC\uAC04 \uC800\uC7A5",
  recoveryLabel: "\uC608\uC0C1 \uC11C\uBC84 \uD68C\uBCF5",
  recoveryPending: "\uC810\uAC80 \uBAA8\uB4DC\uB97C \uCF1C\uBA74 \uC2DC\uC791 \uC2DC\uAC01\uC744 \uAE30\uC900\uC73C\uB85C \uACC4\uC0B0\uB429\uB2C8\uB2E4.",
  testerTitle: "\uC810\uAC80 \uC911 \uD14C\uC2A4\uD2B8 \uACC4\uC815",
  testerBody: "\uC544\uB798 \uB450 \uACC4\uC815\uC740 Admin\uC5D0\uC11C \uC120\uD0DD\uD558\uBA74 Google \uB610\uB294 \uBE44\uBC00\uBC88\uD638 \uB85C\uADF8\uC778 \uC5C6\uC774 \uBC14\uB85C \uC2E4\uC81C \uC571\uC73C\uB85C \uC811\uADFC\uD569\uB2C8\uB2E4.",
  testerSwitchNote: "\uACC4\uC815 \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uD604\uC7AC \uC77C\uBC18 \uC0AC\uC6A9\uC790 \uC138\uC158\uC744 \uD574\uB2F9 \uD14C\uC2A4\uD2B8 \uACC4\uC815 \uC138\uC158\uC73C\uB85C \uBC14\uB85C \uAD50\uCCB4\uD569\uB2C8\uB2E4. Admin \uC138\uC158\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.",
  testerButton: "\uC774 \uACC4\uC815\uC73C\uB85C \uBC14\uB85C \uD14C\uC2A4\uD2B8",
  testerOpening: "\uD14C\uC2A4\uD2B8 \uC138\uC158 \uC900\uBE44 \uC911...",
  testerRequiresMaintenance: "\uD14C\uC2A4\uD2B8 \uACC4\uC815 \uC9C1\uC811 \uC811\uADFC\uC740 \uC810\uAC80 \uBAA8\uB4DC\uB97C \uCF20 \uC0C1\uD0DC\uC5D0\uC11C\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `\uC57D ${minutes}\uBD84`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `\uC57D ${hours}\uC2DC\uAC04 ${remainder}\uBD84` : `\uC57D ${hours}\uC2DC\uAC04`;
}

function formatRecovery(value: string | null) {
  if (!value) return COPY.recoveryPending;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return COPY.recoveryPending;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function AdminMaintenancePanel() {
  const [enabled, setEnabled] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [recoveryAt, setRecoveryAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingEmail, setOpeningEmail] = useState<string | null>(null);
  const [error, setError] = useState("");

  function applyStatus(result: MaintenanceResponse) {
    setEnabled(result.enabled === true);
    if (typeof result.durationMinutes === "number") setDurationMinutes(String(result.durationMinutes));
    setRecoveryAt(typeof result.recoveryAt === "string" ? result.recoveryAt : null);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/maintenance", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("load_failed");
        const result = await response.json() as MaintenanceResponse;
        if (!cancelled) applyStatus(result);
      })
      .catch(() => {
        if (!cancelled) setError(COPY.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function parsedDuration() {
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 24 * 60) return null;
    return duration;
  }

  async function saveSettings(nextEnabled: boolean) {
    const duration = parsedDuration();
    if (duration === null) {
      setError(COPY.invalidDuration);
      return false;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, durationMinutes: duration }),
      });
      if (!response.ok) throw new Error("save_failed");
      applyStatus(await response.json() as MaintenanceResponse);
      return true;
    } catch {
      setError(COPY.error);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    if (saving || loading) return;
    const next = !enabled;
    if (next && !window.confirm(COPY.confirmOn)) return;
    await saveSettings(next);
  }

  async function openTesterAccess(email: string) {
    if (!enabled || openingEmail) return;
    setOpeningEmail(email);
    setError("");
    try {
      const response = await fetch("/api/admin/maintenance-test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("tester_access_failed");
      const result = await response.json() as { appUrl?: string };
      if (!result.appUrl) throw new Error("missing_app_url");
      window.location.assign(result.appUrl);
    } catch {
      setOpeningEmail(null);
      setError(COPY.error);
    }
  }

  const durationValue = parsedDuration();

  return (
    <section className="admin-maintenance-card" aria-live="polite">
      <div className="admin-maintenance-head">
        <div>
          <p>{COPY.eyebrow}</p>
          <h2>{COPY.title}</h2>
        </div>
        <span className={enabled ? "admin-maintenance-status active" : "admin-maintenance-status"}>
          {loading ? COPY.loading : enabled ? COPY.statusOn : COPY.statusOff}
        </span>
      </div>
      <p className="admin-maintenance-body">{COPY.body}</p>
      <p className="admin-maintenance-note">{COPY.adminSafe}</p>

      <div className="admin-maintenance-timing">
        <label htmlFor="maintenance-duration-minutes">
          <strong>{COPY.durationLabel}</strong>
          <span>{COPY.durationHint}</span>
        </label>
        <div className="admin-maintenance-duration-row">
          <div className="admin-maintenance-duration-input">
            <input
              id="maintenance-duration-minutes"
              type="number"
              min="1"
              max="1440"
              inputMode="numeric"
              value={durationMinutes}
              disabled={loading || saving}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
            <span>{COPY.durationUnit}</span>
          </div>
          <button type="button" disabled={loading || saving || durationValue === null} onClick={() => void saveSettings(enabled)}>
            {saving ? COPY.saving : COPY.saveEstimate}
          </button>
        </div>
        <div className="admin-maintenance-recovery-preview">
          <div><span>{COPY.durationLabel}</span><strong>{durationValue === null ? "-" : formatDuration(durationValue)}</strong></div>
          <div><span>{COPY.recoveryLabel}</span><strong>{enabled ? formatRecovery(recoveryAt) : COPY.recoveryPending}</strong></div>
        </div>
      </div>

      {error && <p className="admin-maintenance-error" role="alert">{error}</p>}
      <button
        type="button"
        className={enabled ? "admin-maintenance-toggle stop" : "admin-maintenance-toggle start"}
        disabled={loading || saving || openingEmail !== null || durationValue === null}
        onClick={() => void toggle()}
      >
        {saving ? COPY.saving : enabled ? COPY.turnOff : COPY.turnOn}
      </button>

      <div className="admin-maintenance-testers">
        <div className="admin-maintenance-testers-head">
          <h3>{COPY.testerTitle}</h3>
          <p>{COPY.testerBody}</p>
        </div>
        {!enabled && <p className="admin-maintenance-testers-disabled">{COPY.testerRequiresMaintenance}</p>}
        <div className="admin-maintenance-test-account-list">
          {TEST_ACCOUNTS.map((email) => (
            <article className="admin-maintenance-test-account" key={email}>
              <div>
                <strong>{email}</strong>
                <span>Maintenance tester</span>
              </div>
              <button
                type="button"
                disabled={!enabled || loading || saving || openingEmail !== null}
                onClick={() => void openTesterAccess(email)}
              >
                {openingEmail === email ? COPY.testerOpening : COPY.testerButton}
              </button>
            </article>
          ))}
        </div>
        <p className="admin-maintenance-testers-note">{COPY.testerSwitchNote}</p>
      </div>
    </section>
  );
}

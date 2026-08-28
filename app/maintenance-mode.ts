import { getSqlClient } from "@/db";

const CACHE_MS = 3_000;
const MAINTENANCE_KEY = "maintenance_mode";
const DURATION_KEY = "maintenance_duration_minutes";
const STARTED_AT_KEY = "maintenance_started_at";
const DEFAULT_DURATION_MINUTES = 30;

type MaintenanceStatus = {
  enabled: boolean;
  durationMinutes: number;
  startedAt: string | null;
  recoveryAt: string | null;
};

type MaintenanceCache = MaintenanceStatus & {
  expiresAt: number;
  tableReady?: boolean;
  tablePromise?: Promise<void>;
};

const globalForMaintenance = globalThis as typeof globalThis & {
  couponShareMaintenance?: MaintenanceCache;
};

function cache() {
  if (!globalForMaintenance.couponShareMaintenance) {
    globalForMaintenance.couponShareMaintenance = {
      enabled: false,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      startedAt: null,
      recoveryAt: null,
      expiresAt: 0,
    };
  }
  return globalForMaintenance.couponShareMaintenance;
}

function safeDuration(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DURATION_MINUTES;
  return Math.min(24 * 60, Math.max(1, Math.round(parsed)));
}

function calculateRecoveryAt(startedAt: string | null, durationMinutes: number) {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  return new Date(start + durationMinutes * 60_000).toISOString();
}

async function ensureSettingsTable() {
  const state = cache();
  if (state.tableReady) return;
  if (!state.tablePromise) {
    state.tablePromise = (async () => {
      const sql = getSqlClient();
      await sql`
        create table if not exists public.app_settings (
          key text primary key,
          value text not null,
          updated_at timestamptz not null default now()
        )
      `;
      await sql`alter table public.app_settings enable row level security`;
      await sql`
        insert into public.app_settings (key, value)
        values
          (${MAINTENANCE_KEY}, 'false'),
          (${DURATION_KEY}, ${String(DEFAULT_DURATION_MINUTES)}),
          (${STARTED_AT_KEY}, '')
        on conflict (key) do nothing
      `;
      state.tableReady = true;
    })().catch((error) => {
      state.tablePromise = undefined;
      throw error;
    });
  }
  await state.tablePromise;
}

export async function readMaintenanceStatus(options: { fresh?: boolean } = {}): Promise<MaintenanceStatus> {
  const state = cache();
  const now = Date.now();
  if (!options.fresh && state.expiresAt > now) {
    return {
      enabled: state.enabled,
      durationMinutes: state.durationMinutes,
      startedAt: state.startedAt,
      recoveryAt: state.recoveryAt,
    };
  }

  try {
    await ensureSettingsTable();
    const sql = getSqlClient();
    const rows = await sql<{ key: string; value: string }[]>`
      select key, value
      from public.app_settings
      where key in (${MAINTENANCE_KEY}, ${DURATION_KEY}, ${STARTED_AT_KEY})
    `;
    const values = new Map(rows.map((row) => [row.key, row.value]));
    state.enabled = values.get(MAINTENANCE_KEY) === "true";
    state.durationMinutes = safeDuration(values.get(DURATION_KEY));
    state.startedAt = values.get(STARTED_AT_KEY)?.trim() || null;
    state.recoveryAt = state.enabled ? calculateRecoveryAt(state.startedAt, state.durationMinutes) : null;
    state.expiresAt = now + CACHE_MS;
  } catch (error) {
    console.error("Maintenance mode read failed", error);
    state.enabled = false;
    state.startedAt = null;
    state.recoveryAt = null;
    state.expiresAt = now + 1_000;
  }

  return {
    enabled: state.enabled,
    durationMinutes: state.durationMinutes,
    startedAt: state.startedAt,
    recoveryAt: state.recoveryAt,
  };
}

export async function readMaintenanceMode(options: { fresh?: boolean } = {}) {
  return (await readMaintenanceStatus(options)).enabled;
}

export async function setMaintenanceSettings(enabled: boolean, durationMinutes: number) {
  await ensureSettingsTable();
  const sql = getSqlClient();
  const duration = safeDuration(durationMinutes);
  const current = await readMaintenanceStatus({ fresh: true });
  const startedAt = enabled
    ? current.enabled && current.startedAt ? current.startedAt : new Date().toISOString()
    : null;

  await sql.begin(async (transaction) => {
    await transaction`
      insert into public.app_settings (key, value, updated_at)
      values (${MAINTENANCE_KEY}, ${enabled ? "true" : "false"}, now())
      on conflict (key) do update
        set value = excluded.value,
            updated_at = excluded.updated_at
    `;
    await transaction`
      insert into public.app_settings (key, value, updated_at)
      values (${DURATION_KEY}, ${String(duration)}, now())
      on conflict (key) do update
        set value = excluded.value,
            updated_at = excluded.updated_at
    `;
    await transaction`
      insert into public.app_settings (key, value, updated_at)
      values (${STARTED_AT_KEY}, ${startedAt ?? ""}, now())
      on conflict (key) do update
        set value = excluded.value,
            updated_at = excluded.updated_at
    `;
  });

  const state = cache();
  state.enabled = enabled;
  state.durationMinutes = duration;
  state.startedAt = startedAt;
  state.recoveryAt = enabled ? calculateRecoveryAt(startedAt, duration) : null;
  state.expiresAt = Date.now() + CACHE_MS;

  return {
    enabled: state.enabled,
    durationMinutes: state.durationMinutes,
    startedAt: state.startedAt,
    recoveryAt: state.recoveryAt,
  } satisfies MaintenanceStatus;
}

export async function setMaintenanceMode(enabled: boolean) {
  const current = await readMaintenanceStatus({ fresh: true });
  return (await setMaintenanceSettings(enabled, current.durationMinutes)).enabled;
}

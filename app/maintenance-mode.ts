import { getSqlClient } from "@/db";

const CACHE_MS = 3_000;
const MAINTENANCE_KEY = "maintenance_mode";

type MaintenanceCache = {
  enabled: boolean;
  expiresAt: number;
  tableReady?: boolean;
  tablePromise?: Promise<void>;
};

const globalForMaintenance = globalThis as typeof globalThis & {
  couponShareMaintenance?: MaintenanceCache;
};

function cache() {
  if (!globalForMaintenance.couponShareMaintenance) {
    globalForMaintenance.couponShareMaintenance = { enabled: false, expiresAt: 0 };
  }
  return globalForMaintenance.couponShareMaintenance;
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
        values (${MAINTENANCE_KEY}, 'false')
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

export async function readMaintenanceMode(options: { fresh?: boolean } = {}) {
  const state = cache();
  const now = Date.now();
  if (!options.fresh && state.expiresAt > now) return state.enabled;

  try {
    await ensureSettingsTable();
    const sql = getSqlClient();
    const [row] = await sql<{ enabled: boolean }[]>`
      select value = 'true' as enabled
      from public.app_settings
      where key = ${MAINTENANCE_KEY}
      limit 1
    `;
    state.enabled = row?.enabled === true;
    state.expiresAt = now + CACHE_MS;
    return state.enabled;
  } catch (error) {
    console.error("Maintenance mode read failed", error);
    state.enabled = false;
    state.expiresAt = now + 1_000;
    return false;
  }
}

export async function setMaintenanceMode(enabled: boolean) {
  await ensureSettingsTable();
  const sql = getSqlClient();
  await sql`
    insert into public.app_settings (key, value, updated_at)
    values (${MAINTENANCE_KEY}, ${enabled ? "true" : "false"}, now())
    on conflict (key) do update
      set value = excluded.value,
          updated_at = excluded.updated_at
  `;

  const state = cache();
  state.enabled = enabled;
  state.expiresAt = Date.now() + CACHE_MS;
  return enabled;
}

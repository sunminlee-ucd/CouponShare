import { getSqlClient, withSqlReconnect } from "@/db";
import { authConfiguration } from "@/app/auth/session";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPABASE_REQUEST_TIMEOUT_MS = 4_000;
const AUTH_ACCOUNT_CACHE_MS = 5 * 60_000;

type SupabaseUser = {
  id: string;
  email?: string | null;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
};

export type SupabaseAuthSession = {
  accessToken: string;
  user: SupabaseUser | null;
};

type LinkedProfile = {
  profileId: string;
  deviceKey: string;
  authUserId: string;
};

export type AuthAccount = {
  email: string | null;
  provider: "google" | "email" | string;
};

type CachedAuthAccount = {
  value: AuthAccount;
  expiresAt: number;
};

const globalForAuth = globalThis as typeof globalThis & {
  couponShareAuthAccounts?: Map<string, CachedAuthAccount>;
};

async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function validSupabaseUser(value: unknown): SupabaseUser | null {
  if (!value || typeof value !== "object") return null;
  const user = value as SupabaseUser;
  return uuidPattern.test(user.id ?? "") ? user : null;
}

export async function exchangeSupabaseAuthCode(authCode: string, codeVerifier: string): Promise<SupabaseAuthSession | null> {
  if (authCode.length < 10 || !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier)) return null;
  const configuration = await authConfiguration();
  if (!configuration.configured) return null;

  try {
    const response = await fetchWithTimeout(`${configuration.url}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        apikey: configuration.publishableKey,
        authorization: `Bearer ${configuration.publishableKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as {
      access_token?: string;
      user?: SupabaseUser;
      error?: string;
      error_description?: string;
      msg?: string;
      message?: string;
    };
    if (!response.ok) {
      console.error(
        "Supabase PKCE exchange failed",
        response.status,
        result.error_description ?? result.msg ?? result.message ?? result.error ?? "unknown_error",
      );
      return null;
    }
    if (!result.access_token || result.access_token.length < 20) return null;
    return {
      accessToken: result.access_token,
      // Supabase normally returns the authenticated user with the PKCE token response.
      // Reusing it removes an unnecessary second network round-trip on the common path.
      user: validSupabaseUser(result.user),
    };
  } catch (error) {
    console.error("Supabase PKCE exchange unavailable", error);
    return null;
  }
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<SupabaseUser | null> {
  if (!accessToken || accessToken.length < 20) return null;
  const configuration = await authConfiguration();
  if (!configuration.configured) return null;
  try {
    const response = await fetchWithTimeout(`${configuration.url}/auth/v1/user`, {
      headers: {
        apikey: configuration.publishableKey,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return validSupabaseUser(await response.json());
  } catch {
    return null;
  }
}

export async function getAuthenticatedAccount(authUserId: string): Promise<AuthAccount | null> {
  if (!uuidPattern.test(authUserId)) return null;
  const cache = globalForAuth.couponShareAuthAccounts ??= new Map<string, CachedAuthAccount>();
  const cached = cache.get(authUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const sql = getSqlClient();
    const [account] = await sql<{ email: string | null; provider: string | null }[]>`
      select
        email,
        coalesce(raw_app_meta_data ->> 'provider', 'email') as provider
      from auth.users
      where id = ${authUserId}::uuid
      limit 1
    `;
    if (!account) return null;
    const value: AuthAccount = {
      email: account.email,
      provider: account.provider || "email",
    };
    cache.set(authUserId, { value, expiresAt: Date.now() + AUTH_ACCOUNT_CACHE_MS });
    return value;
  } catch (error) {
    console.error("Auth account lookup failed", error);
    return null;
  }
}

export async function linkAuthenticatedProfile(authUserId: string, requestedDeviceKey: string): Promise<LinkedProfile> {
  if (!uuidPattern.test(authUserId)) throw new Error("invalid_auth_user");
  const deviceKey = uuidPattern.test(requestedDeviceKey) ? requestedDeviceKey : crypto.randomUUID();

  return withSqlReconnect(async (sql) => {
    // Returning users are the overwhelmingly common login path. A plain indexed read avoids
    // opening a transaction, taking a row lock and writing updated_at on every sign-in.
    const [existing] = await sql<{ id: string; device_key: string }[]>`
      select id::text, device_key::text
      from profiles
      where auth_user_id = ${authUserId}::uuid
      limit 1
    `;
    if (existing) return { profileId: existing.id, deviceKey: existing.device_key, authUserId };

    return sql.begin(async (tx) => {
      // Re-check under a lock so simultaneous first logins cannot create duplicate profiles.
      const [linked] = await tx<{ id: string; device_key: string }[]>`
        select id::text, device_key::text
        from profiles
        where auth_user_id = ${authUserId}::uuid
        limit 1
        for update
      `;
      if (linked) return { profileId: linked.id, deviceKey: linked.device_key, authUserId };

      const [current] = await tx<{ id: string; auth_user_id: string | null; device_key: string }[]>`
        select id::text, auth_user_id::text, device_key::text
        from profiles
        where device_key = ${deviceKey}::uuid
        limit 1
        for update
      `;

      if (current && current.auth_user_id && current.auth_user_id !== authUserId) {
        const replacementDeviceKey = crypto.randomUUID();
        const [created] = await tx<{ id: string; device_key: string }[]>`
          insert into profiles (device_key, auth_user_id, updated_at)
          values (${replacementDeviceKey}::uuid, ${authUserId}::uuid, now())
          returning id::text, device_key::text
        `;
        return { profileId: created.id, deviceKey: created.device_key, authUserId };
      }

      if (current) {
        const [updated] = await tx<{ id: string; device_key: string }[]>`
          update profiles
          set auth_user_id = ${authUserId}::uuid, updated_at = now()
          where id = ${current.id}::uuid
          returning id::text, device_key::text
        `;
        return { profileId: updated.id, deviceKey: updated.device_key, authUserId };
      }

      try {
        const [created] = await tx<{ id: string; device_key: string }[]>`
          insert into profiles (device_key, auth_user_id, updated_at)
          values (${deviceKey}::uuid, ${authUserId}::uuid, now())
          returning id::text, device_key::text
        `;
        return { profileId: created.id, deviceKey: created.device_key, authUserId };
      } catch (error) {
        if ((error as { code?: string }).code !== "23505") throw error;
        const [raced] = await tx<{ id: string; device_key: string }[]>`
          select id::text, device_key::text
          from profiles
          where auth_user_id = ${authUserId}::uuid
          limit 1
        `;
        if (!raced) throw error;
        return { profileId: raced.id, deviceKey: raced.device_key, authUserId };
      }
    });
  });
}

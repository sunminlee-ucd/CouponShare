import { getSqlClient } from "@/db";
import { authConfiguration } from "@/app/auth/session";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseUser = {
  id: string;
  email?: string | null;
};

type LinkedProfile = {
  profileId: string;
  deviceKey: string;
  authUserId: string;
};

export async function verifySupabaseAccessToken(accessToken: string): Promise<SupabaseUser | null> {
  if (!accessToken || accessToken.length < 20) return null;
  const configuration = await authConfiguration();
  if (!configuration.configured) return null;
  try {
    const response = await fetch(`${configuration.url}/auth/v1/user`, {
      headers: {
        apikey: configuration.serviceRoleKey,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const user = await response.json() as SupabaseUser;
    return uuidPattern.test(user.id ?? "") ? user : null;
  } catch {
    return null;
  }
}

export async function linkAuthenticatedProfile(authUserId: string, requestedDeviceKey: string): Promise<LinkedProfile> {
  if (!uuidPattern.test(authUserId)) throw new Error("invalid_auth_user");
  const deviceKey = uuidPattern.test(requestedDeviceKey) ? requestedDeviceKey : crypto.randomUUID();
  const sql = getSqlClient();

  return sql.begin(async (tx) => {
    const [linked] = await tx<{ id: string; device_key: string }[]>`
      select id::text, device_key::text
      from profiles
      where auth_user_id = ${authUserId}::uuid
      limit 1
      for update
    `;
    if (linked) {
      await tx`update profiles set updated_at = now() where id = ${linked.id}::uuid`;
      return { profileId: linked.id, deviceKey: linked.device_key, authUserId };
    }

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
}

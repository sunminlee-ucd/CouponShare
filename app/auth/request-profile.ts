import { getSqlClient } from "@/db";
import {
  readCookie,
  USER_AUTH_COOKIE_NAME,
  type UserAuthSession,
  verifyUserAuthToken,
} from "@/app/auth/session";

export type AuthenticatedRequestProfile = {
  id: string;
  authUserId: string;
  isBlocked: boolean;
};

export type AuthenticatedRequestContext = {
  session: UserAuthSession | null;
  profile: AuthenticatedRequestProfile | null;
};

export async function authenticatedRequestContext(request: Request): Promise<AuthenticatedRequestContext> {
  const token = readCookie(request.headers.get("cookie"), USER_AUTH_COOKIE_NAME);
  const session = await verifyUserAuthToken(token);
  if (!session) return { session: null, profile: null };

  const sql = getSqlClient();
  const [profile] = await sql<{ id: string; auth_user_id: string; is_blocked: boolean }[]>`
    select id::text, auth_user_id::text, is_blocked
    from profiles
    where id = ${session.profileId}::uuid
      and auth_user_id = ${session.authUserId}::uuid
    limit 1
  `;

  return {
    session,
    profile: profile
      ? { id: profile.id, authUserId: profile.auth_user_id, isBlocked: profile.is_blocked }
      : null,
  };
}

export async function authenticatedRequestProfile(request: Request) {
  return (await authenticatedRequestContext(request)).profile;
}

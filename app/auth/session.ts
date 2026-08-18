import { accessConfiguration } from "@/app/access/session";

export const USER_AUTH_COOKIE_NAME = "couponshare_user_v1";
const SESSION_DAYS = 30;

export type UserAuthSession = {
  authUserId: string;
  profileId: string;
  issuedAt: number;
  expiresAt: number;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`couponshare-auth-session-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function authConfiguration() {
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const access = await accessConfiguration();
  return {
    url,
    serviceRoleKey,
    sessionSecret: access.sessionSecret,
    configured: /^https:\/\/.+\.supabase\.co$/i.test(url) && serviceRoleKey.length >= 20 && access.configured,
    required: process.env.AUTH_REQUIRED === "true",
  };
}

export async function createUserAuthToken(authUserId: string, profileId: string, now = Date.now()) {
  const configuration = await authConfiguration();
  if (!configuration.configured) throw new Error("Auth is not configured");
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${authUserId}.${profileId}.${now}.${expiresAt}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(configuration.sessionSecret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyUserAuthToken(token: string | undefined, now = Date.now()): Promise<UserAuthSession | null> {
  const configuration = await authConfiguration();
  if (!configuration.configured || !token) return null;
  const [authUserId, profileId, issuedText, expiresText, signature] = token.split(".");
  const issuedAt = Number(issuedText);
  const expiresAt = Number(expiresText);
  if (!authUserId || !profileId || !signature || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (issuedAt > now + 60_000 || expiresAt <= now || expiresAt - issuedAt > (SESSION_DAYS + 1) * 24 * 60 * 60 * 1000) return null;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(configuration.sessionSecret),
    signatureBytes,
    new TextEncoder().encode(`${authUserId}.${profileId}.${issuedText}.${expiresText}`),
  );
  return valid ? { authUserId, profileId, issuedAt, expiresAt } : null;
}

export function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export const USER_AUTH_COOKIE_NAME = "couponshare_user_v1";
export const BROWSE_ACCESS_COOKIE_NAME = "couponshare_browse_v1";
export const AUTO_LOGIN_COOKIE_NAME = "couponshare_auto_login_v1";
export const OAUTH_PKCE_COOKIE_NAME = "couponshare_oauth_pkce_v1";
const SESSION_DAYS = 30;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const BROWSE_HOURS = 12;
const OAUTH_PKCE_SECONDS = 10 * 60;

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

async function deriveSessionSecret(adminPassword: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(adminPassword),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("couponshare-user-auth-session-secret-v1"),
  );
  return base64Url(new Uint8Array(digest));
}

async function userSessionSecret() {
  const explicit = process.env.AUTH_SESSION_SECRET ?? "";
  if (explicit.length >= 32) return explicit;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (adminPassword.length < 16) return "";
  return deriveSessionSecret(adminPassword);
}

export async function authConfiguration() {
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
  const sessionSecret = await userSessionSecret();
  return {
    url,
    publishableKey,
    sessionSecret,
    configured: /^https:\/\/.+\.supabase\.co$/i.test(url) && publishableKey.length >= 20 && sessionSecret.length >= 32,
    required: process.env.AUTH_REQUIRED === "true",
  };
}

export function requestHasSameOrigin(request: Request) {
  try {
    const allowedHosts = new Set<string>();
    allowedHosts.add(new URL(request.url).host.toLowerCase());

    for (const header of [request.headers.get("x-forwarded-host"), request.headers.get("host")]) {
      const host = header?.split(",")[0]?.trim().toLowerCase();
      if (host) allowedHosts.add(host);
    }

    const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
    if (fetchSite === "same-origin") return true;

    let suppliedSource = false;
    for (const source of [request.headers.get("origin"), request.headers.get("referer")]) {
      if (!source || source === "null") continue;
      suppliedSource = true;
      if (allowedHosts.has(new URL(source).host.toLowerCase())) return true;
    }

    if (suppliedSource) return false;
    return fetchSite === "same-site" || fetchSite === "none";
  } catch {
    return false;
  }
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

export async function createBrowseAccessToken(now = Date.now()) {
  const configuration = await authConfiguration();
  if (!configuration.configured) throw new Error("Auth is not configured");
  const expiresAt = now + BROWSE_HOURS * 60 * 60 * 1000;
  const payload = `browse.${now}.${expiresAt}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(configuration.sessionSecret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyBrowseAccessToken(token: string | undefined, now = Date.now()) {
  const configuration = await authConfiguration();
  if (!configuration.configured || !token) return false;
  const [kind, issuedText, expiresText, signature] = token.split(".");
  const issuedAt = Number(issuedText);
  const expiresAt = Number(expiresText);
  if (kind !== "browse" || !signature || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return false;
  if (issuedAt > now + 60_000 || expiresAt <= now || expiresAt - issuedAt > (BROWSE_HOURS + 1) * 60 * 60 * 1000) return false;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return false;
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(configuration.sessionSecret),
    signatureBytes,
    new TextEncoder().encode(`${kind}.${issuedText}.${expiresText}`),
  );
}

export function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function userAuthCookie(token: string, autoLogin: boolean) {
  const persistence = autoLogin ? `; Max-Age=${SESSION_SECONDS}` : "";
  return `${USER_AUTH_COOKIE_NAME}=${token}; Path=/${persistence}; HttpOnly; Secure; SameSite=Lax`;
}

export function autoLoginPreferenceCookie(enabled: boolean) {
  return `${AUTO_LOGIN_COOKIE_NAME}=${enabled ? "1" : "0"}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

export function browseAccessCookie(token: string) {
  return `${BROWSE_ACCESS_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function oauthPkceCookie(codeVerifier: string) {
  return `${OAUTH_PKCE_COOKIE_NAME}=${encodeURIComponent(codeVerifier)}; Path=/; Max-Age=${OAUTH_PKCE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearUserAuthCookie() {
  return `${USER_AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function clearBrowseAccessCookie() {
  return `${BROWSE_ACCESS_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function clearOAuthPkceCookie() {
  return `${OAUTH_PKCE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}

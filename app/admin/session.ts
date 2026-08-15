export const ADMIN_COOKIE_NAME = "couponshare_admin_v1";
export const ADMIN_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const ADMIN_SESSION_DAYS = 30;

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

function signingKey(password: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function requestHasSameOrigin(request: Request) {
  try {
    const allowedHosts = new Set<string>();
    allowedHosts.add(new URL(request.url).host.toLowerCase());
    for (const header of [request.headers.get("x-forwarded-host"), request.headers.get("host")]) {
      const host = header?.split(",")[0]?.trim().toLowerCase();
      if (host) allowedHosts.add(host);
    }
    let suppliedSource = false;
    for (const source of [request.headers.get("origin"), request.headers.get("referer")]) {
      if (!source || source === "null") continue;
      suppliedSource = true;
      if (allowedHosts.has(new URL(source).host.toLowerCase())) return true;
    }
    if (suppliedSource) return false;
    return request.headers.get("sec-fetch-site") === "same-origin";
  } catch {
    return false;
  }
}

export async function createAdminToken(password: string, now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_MAX_AGE * 1000;
  const payload = `${now}.${expiresAt}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(password),
    new TextEncoder().encode(`couponshare-admin-session-v1.${payload}`),
  );
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminToken(token: string | undefined, password: string, now = Date.now()) {
  if (!token || password.length < 16) return false;
  const [issuedText, expiresText, signature] = token.split(".");
  const issuedAt = Number(issuedText);
  const expiresAt = Number(expiresText);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || !signature) return false;
  if (issuedAt > now + 60_000 || expiresAt <= now || expiresAt - issuedAt > (ADMIN_SESSION_DAYS + 1) * 24 * 60 * 60 * 1000) return false;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return false;
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(password),
    signatureBytes,
    new TextEncoder().encode(`couponshare-admin-session-v1.${issuedText}.${expiresText}`),
  );
}

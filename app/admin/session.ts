import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "couponshare_admin_v1";
export const ADMIN_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const ADMIN_SESSION_DAYS = 30;

function signatureFor(payload: string, password: string) {
  return createHmac("sha256", password).update(`couponshare-admin-session-v1.${payload}`).digest("base64url");
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

export function createAdminToken(password: string, now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_MAX_AGE * 1000;
  const payload = `${now}.${expiresAt}`;
  return `${payload}.${signatureFor(payload, password)}`;
}

export function verifyAdminToken(token: string | undefined, password: string, now = Date.now()) {
  if (!token || password.length < 16) return false;
  const [issuedText, expiresText, signature] = token.split(".");
  const issuedAt = Number(issuedText);
  const expiresAt = Number(expiresText);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || !signature) return false;
  if (issuedAt > now + 60_000 || expiresAt <= now || expiresAt - issuedAt > (ADMIN_SESSION_DAYS + 1) * 24 * 60 * 60 * 1000) return false;
  const expected = signatureFor(`${issuedText}.${expiresText}`, password);
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

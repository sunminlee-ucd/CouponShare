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

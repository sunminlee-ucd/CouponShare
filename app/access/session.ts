export const ACCESS_COOKIE_NAME = "couponshare_access_v1";
const SESSION_DAYS = 30;

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
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function derivedAccessConfiguration(adminPassword: string) {
  const key = await signingKey(adminPassword);
  const [accessDigest, sessionDigest] = await Promise.all([
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode("couponshare-private-access-v1")),
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode("couponshare-private-session-v1")),
  ]);
  return {
    accessCode: `CS-${base64Url(new Uint8Array(accessDigest)).slice(0, 12).toUpperCase()}`,
    sessionSecret: base64Url(new Uint8Array(sessionDigest)),
    configured: true,
    derivedFromAdminPassword: true,
  };
}

export async function accessConfiguration() {
  const accessCode = process.env.APP_ACCESS_CODE ?? "";
  const sessionSecret = process.env.APP_SESSION_SECRET ?? "";
  if (accessCode.length >= 8 && sessionSecret.length >= 32) {
    return { accessCode, sessionSecret, configured: true, derivedFromAdminPassword: false };
  }
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (adminPassword.length >= 16) return derivedAccessConfiguration(adminPassword);
  return {
    accessCode,
    sessionSecret,
    configured: false,
    derivedFromAdminPassword: false,
  };
}

export async function createAccessToken(secret: string, now = Date.now()) {
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${now}.${expiresAt}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyAccessToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token || secret.length < 32) return false;
  const [issuedText, expiresText, signature] = token.split(".");
  const issuedAt = Number(issuedText);
  const expiresAt = Number(expiresText);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || !signature) return false;
  if (issuedAt > now + 60_000 || expiresAt <= now || expiresAt - issuedAt > (SESSION_DAYS + 1) * 24 * 60 * 60 * 1000) return false;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return false;
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    signatureBytes,
    new TextEncoder().encode(`${issuedText}.${expiresText}`),
  );
}

export async function secureTextEqual(left: string, right: string) {
  const key = await signingKey("couponshare-constant-time-comparison-key");
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(left)),
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export const MAINTENANCE_TEST_COOKIE_NAME = "couponshare_maintenance_test_v1";
export const MAINTENANCE_TEST_EMAILS = [
  "leesunmin7212@gmail.com",
  "atena.zahiri73@gmail.com",
] as const;

const TEST_SESSION_SECONDS = 12 * 60 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MaintenanceTestGrant = {
  email: string;
  authUserId: string;
  issuedAt: number;
  expiresAt: number;
};

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function isMaintenanceTestEmail(value: string | null | undefined): value is typeof MAINTENANCE_TEST_EMAILS[number] {
  const email = normalizeEmail(value);
  return MAINTENANCE_TEST_EMAILS.some((allowed) => allowed === email);
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

async function signingKey() {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  if (secret.length < 16) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`couponshare-maintenance-test-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signatureFor(payload: string) {
  const key = await signingKey();
  if (!key) throw new Error("Maintenance tester signing is not configured");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signatureBytes(value: string) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function createMaintenanceTestToken(emailValue: string, authUserId: string, now = Date.now()) {
  const email = normalizeEmail(emailValue);
  if (!isMaintenanceTestEmail(email)) throw new Error("Maintenance tester email is not allowed");
  if (!uuidPattern.test(authUserId)) throw new Error("Invalid maintenance tester auth user");
  const grant: MaintenanceTestGrant = {
    email,
    authUserId,
    issuedAt: now,
    expiresAt: now + TEST_SESSION_SECONDS * 1000,
  };
  const payload = base64UrlEncode(JSON.stringify(grant));
  return `${payload}.${await signatureFor(payload)}`;
}

export async function verifyMaintenanceTestToken(token: string | undefined, now = Date.now()): Promise<MaintenanceTestGrant | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const key = await signingKey();
  const bytes = signatureBytes(signature);
  if (!key || !bytes) return null;
  const valid = await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(payload));
  if (!valid) return null;
  const decoded = base64UrlDecode(payload);
  if (!decoded) return null;
  try {
    const grant = JSON.parse(decoded) as Partial<MaintenanceTestGrant>;
    const email = normalizeEmail(grant.email);
    const authUserId = String(grant.authUserId ?? "");
    const issuedAt = Number(grant.issuedAt);
    const expiresAt = Number(grant.expiresAt);
    if (!isMaintenanceTestEmail(email) || !uuidPattern.test(authUserId)) return null;
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
    if (issuedAt > now + 60_000 || expiresAt <= now) return null;
    if (expiresAt - issuedAt > (TEST_SESSION_SECONDS + 60) * 1000) return null;
    return { email, authUserId, issuedAt, expiresAt };
  } catch {
    return null;
  }
}

export function maintenanceTestCookie(token: string) {
  return `${MAINTENANCE_TEST_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${TEST_SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearMaintenanceTestCookie() {
  return `${MAINTENANCE_TEST_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

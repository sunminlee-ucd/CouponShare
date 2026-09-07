import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign as cryptoSign } from "node:crypto";

const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const MAX_PUSH_PAYLOAD_BYTES = 3000;

function b64url(value: Buffer) {
  return value.toString("base64url");
}

function decodeB64url(value: string) {
  return Buffer.from(value, "base64url");
}

function hkdfExtract(salt: Buffer, ikm: Buffer) {
  return createHmac("sha256", salt).update(ikm).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  let previous = Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let counter = 1;
  let total = 0;
  while (total < length) {
    previous = createHmac("sha256", prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest();
    chunks.push(previous);
    total += previous.length;
    counter += 1;
  }
  return Buffer.concat(chunks).subarray(0, length);
}

function vapidSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 16) throw new Error("A stable server secret is required for Web Push.");
  return secret;
}

function derivedVapidKey() {
  const digest = createHmac("sha256", vapidSecret()).update("couponshare:web-push:v1").digest();
  const scalar = (BigInt(`0x${digest.toString("hex")}`) % (P256_ORDER - BigInt(1))) + BigInt(1);
  const privateKeyBytes = Buffer.from(scalar.toString(16).padStart(64, "0"), "hex");
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateKeyBytes);
  const publicKey = ecdh.getPublicKey(undefined, "uncompressed");
  const x = publicKey.subarray(1, 33);
  const y = publicKey.subarray(33, 65);
  const privateKey = createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64url(x), y: b64url(y), d: b64url(privateKeyBytes) },
    format: "jwk",
  });
  return { privateKey, publicKey };
}

export function getVapidPublicKey() {
  return b64url(derivedVapidKey().publicKey);
}

function vapidAuthorization(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("Push endpoint must use HTTPS.");
  const { privateKey, publicKey } = derivedVapidKey();
  const now = Math.floor(Date.now() / 1000);
  const contact = process.env.PRIVACY_CONTACT_EMAIL?.includes("@")
    ? `mailto:${process.env.PRIVACY_CONTACT_EMAIL}`
    : "https://couponshare-ireland-493377120974.europe-west1.run.app";
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(Buffer.from(JSON.stringify({ aud: url.origin, exp: now + 12 * 60 * 60, sub: contact })));
  const input = `${header}.${payload}`;
  const signature = cryptoSign("sha256", Buffer.from(input), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `vapid t=${input}.${b64url(signature)}, k=${b64url(publicKey)}`;
}

function encryptPayload(payload: Buffer, userPublicKey: Buffer, authSecret: Buffer) {
  if (userPublicKey.length !== 65 || userPublicKey[0] !== 4) throw new Error("Invalid Web Push public key.");
  if (authSecret.length < 16) throw new Error("Invalid Web Push auth secret.");

  const ephemeral = createECDH("prime256v1");
  ephemeral.generateKeys();
  const serverPublicKey = ephemeral.getPublicKey(undefined, "uncompressed");
  const sharedSecret = ephemeral.computeSecret(userPublicKey);
  const prkKey = hkdfExtract(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    userPublicKey,
    serverPublicKey,
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  const salt = randomBytes(16);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
  const plaintext = Buffer.concat([payload, Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublicKey.length]), serverPublicKey, encrypted]);
}

export async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: unknown) {
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  if (payloadBytes.length > MAX_PUSH_PAYLOAD_BYTES) throw new Error("Push payload is too large.");
  const body = encryptPayload(payloadBytes, decodeB64url(subscription.p256dh), decodeB64url(subscription.auth));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(subscription.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "normal",
      },
      body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

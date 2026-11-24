/**
 * Edge-safe session token helpers.
 *
 * The token is a signed, expiring payload: base64url(JSON).base64url(HMAC-SHA256).
 * The secret is never included in the token, unlike the previous implementation.
 * These helpers are shared by the login route and the Next.js proxy.
 */

export const SESSION_COOKIE = "construction_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

type SessionPayload = {
  sub: number;
  exp: number;
};

function getSecret() {
  return process.env.SESSION_SECRET || "dev-only-construction-session-secret";
}

function encodeBase64Url(input: Uint8Array) {
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createSessionToken(userId: number) {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

export async function verifySessionToken(
  token: string | null | undefined,
): Promise<{ userId: number } | null> {
  if (!token) return null;

  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  if (!safeEqual(signature, await sign(encoded))) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as Partial<SessionPayload>;
    if (
      typeof parsed.sub !== "number" ||
      !Number.isInteger(parsed.sub) ||
      parsed.sub <= 0 ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { userId: parsed.sub };
  } catch {
    return null;
  }
}

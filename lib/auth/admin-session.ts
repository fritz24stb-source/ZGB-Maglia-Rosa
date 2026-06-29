export const ADMIN_SESSION_COOKIE = "zgb_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const ADMIN_SESSION_MESSAGE = "zgb-strava-admin-session:v1";

export function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("Missing required environment variable: ADMIN_PASSWORD");
  }

  return password;
}

export function isAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function createAdminSessionToken(password = getAdminPassword()) {
  return signAdminSession(password, ADMIN_SESSION_MESSAGE);
}

export async function hasValidAdminSession(token: string | undefined | null) {
  if (!token) {
    return false;
  }

  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return false;
  }

  const expectedToken = await createAdminSessionToken(password);

  return timingSafeStringEqual(token, expectedToken);
}

async function signAdminSession(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  return toBase64Url(new Uint8Array(signature));
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeStringEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

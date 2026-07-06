import type { NextResponse } from "next/server";

export const APP_SESSION_COOKIE = "zgb_app_session";
export const APP_SESSION_COOKIE_PATH = "/";
export const APP_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type AppSession = {
  issuedAt: number;
  userId: string;
};

export function getAppAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: APP_AUTH_SECRET");
  }

  return secret;
}

export async function createAppSessionToken(userId: string, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = `${userId}:${issuedAt}`;
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(payload));
  const signature = await signValue(encodedPayload, getAppAuthSecret());

  return `${encodedPayload}.${signature}`;
}

export async function readAppSessionToken(
  token: string | undefined | null,
  now = new Date(),
): Promise<AppSession | null> {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  let expectedSignature: string;

  try {
    expectedSignature = await signValue(encodedPayload, getAppAuthSecret());
  } catch {
    return null;
  }

  if (!timingSafeBase64UrlEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = new TextDecoder().decode(base64UrlToBytes(encodedPayload));
  const [userId, issuedAtValue] = payload.split(":");
  const issuedAt = Number(issuedAtValue);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (!userId || !Number.isInteger(issuedAt)) {
    return null;
  }

  if (
    issuedAt > nowSeconds ||
    nowSeconds - issuedAt > APP_SESSION_MAX_AGE_SECONDS
  ) {
    return null;
  }

  return { issuedAt, userId };
}

export async function setAppSessionCookie(
  response: NextResponse,
  userId: string,
  requestUrl: string,
) {
  response.cookies.set(
    APP_SESSION_COOKIE,
    await createAppSessionToken(userId),
    {
      httpOnly: true,
      maxAge: APP_SESSION_MAX_AGE_SECONDS,
      path: APP_SESSION_COOKIE_PATH,
      sameSite: "lax",
      secure: new URL(requestUrl).protocol === "https:",
    },
  );
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", {
    maxAge: 0,
    path: APP_SESSION_COOKIE_PATH,
  });
}

async function signValue(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeBase64UrlEqual(left: string, right: string) {
  const leftBytes = base64UrlToBytes(left);
  const rightBytes = base64UrlToBytes(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

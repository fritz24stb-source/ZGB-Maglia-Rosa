import "server-only";

import {
  createHash,
  createHmac,
  createPublicKey,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getAppAuthSecret } from "@/lib/auth/app-session";
import { getAppBaseUrl } from "@/lib/env";

export const PASSKEY_REGISTER_STATE_COOKIE = "zgb_passkey_register";
export const PASSKEY_LOGIN_STATE_COOKIE = "zgb_passkey_login";
export const PASSKEY_STATE_MAX_AGE_SECONDS = 10 * 60;

type PasskeyState = {
  challenge: string;
  expiresAt: number;
  type: "login" | "register";
  userId: string;
};

type ClientData = {
  challenge?: string;
  origin?: string;
  type?: string;
};

export function generateWebAuthnChallenge() {
  return randomBytes(32).toString("base64url");
}

export function getWebAuthnRpId() {
  return new URL(getAppBaseUrl()).hostname;
}

export function getWebAuthnOrigin() {
  return new URL(getAppBaseUrl()).origin;
}

export function buildUserHandle(userId: string) {
  return Buffer.from(userId, "utf8").toString("base64url");
}

export function createPasskeyStateCookieValue(
  state: Omit<PasskeyState, "expiresAt">,
  now = new Date(),
) {
  const payload = Buffer.from(
    JSON.stringify({
      ...state,
      expiresAt:
        Math.floor(now.getTime() / 1000) + PASSKEY_STATE_MAX_AGE_SECONDS,
    }),
    "utf8",
  ).toString("base64url");
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function readPasskeyStateCookieValue(
  value: string | undefined,
  expectedType: PasskeyState["type"],
  now = new Date(),
) {
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);

  if (!timingSafeBase64UrlEqual(signature, expectedSignature)) {
    return null;
  }

  const state = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as PasskeyState;
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (
    state.type !== expectedType ||
    !state.challenge ||
    !state.userId ||
    state.expiresAt < nowSeconds
  ) {
    return null;
  }

  return state;
}

export function validateClientData(input: {
  challenge: string;
  clientDataJSON: string;
  expectedType: "webauthn.create" | "webauthn.get";
}) {
  const clientData = JSON.parse(
    Buffer.from(input.clientDataJSON, "base64url").toString("utf8"),
  ) as ClientData;

  if (clientData.type !== input.expectedType) {
    throw new Error("Passkey-Antwort hat den falschen Typ.");
  }

  if (clientData.challenge !== input.challenge) {
    throw new Error("Passkey-Challenge passt nicht.");
  }

  if (clientData.origin !== getWebAuthnOrigin()) {
    throw new Error("Passkey-Origin passt nicht.");
  }
}

export function parseAuthenticatorData(authenticatorData: string) {
  const bytes = Buffer.from(authenticatorData, "base64url");

  if (bytes.length < 37) {
    throw new Error("Passkey-Authenticatordaten sind unvollstaendig.");
  }

  const flags = bytes[32];
  const signCount = bytes.readUInt32BE(33);

  return {
    signCount,
    userPresent: (flags & 0x01) === 0x01,
    userVerified: (flags & 0x04) === 0x04,
  };
}

export function verifyPasskeySignature(input: {
  algorithm: number;
  authenticatorData: string;
  clientDataJSON: string;
  publicKeySpki: string;
  signature: string;
}) {
  if (input.algorithm !== -7 && input.algorithm !== -257) {
    throw new Error("Passkey-Algorithmus wird nicht unterstützt.");
  }

  const clientData = Buffer.from(input.clientDataJSON, "base64url");
  const signedData = Buffer.concat([
    Buffer.from(input.authenticatorData, "base64url"),
    createHash("sha256").update(clientData).digest(),
  ]);
  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.from(input.publicKeySpki, "base64url"),
    type: "spki",
  });
  const verifier = createVerify("SHA256");
  verifier.update(signedData);
  verifier.end();

  return verifier.verify(publicKey, Buffer.from(input.signature, "base64url"));
}

function signPayload(payload: string) {
  return createHmac("sha256", getAppAuthSecret())
    .update(payload)
    .digest("base64url");
}

function timingSafeBase64UrlEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left, "base64url");
  const rightBytes = Buffer.from(right, "base64url");

  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

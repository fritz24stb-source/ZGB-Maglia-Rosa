import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { normalizeDisplayNameKey } from "@/lib/auth/names";

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_LONG_PHRASE_LENGTH = 14;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const commonPasswords = new Set([
  "1234567890",
  "password",
  "passwort",
  "qwertz12345",
  "zgbstrava",
  "strava2026",
  "welcome123",
  "willkommen",
]);

export function validatePasswordPolicy(password: string, displayName: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`,
    );
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Passwort darf maximal ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`,
    );
  }

  const passwordKey = password.toLocaleLowerCase("de");

  if (commonPasswords.has(passwordKey)) {
    throw new Error("Dieses Passwort ist zu leicht zu erraten.");
  }

  const nameKey = normalizeDisplayNameKey(displayName);
  const compactNameKey = nameKey.replace(/\s+/g, "");
  const compactPasswordKey = passwordKey.replace(/\s+/g, "");

  if (
    (nameKey.length >= 4 && passwordKey.includes(nameKey)) ||
    (compactNameKey.length >= 4 && compactPasswordKey.includes(compactNameKey))
  ) {
    throw new Error("Passwort darf den Namen nicht enthalten.");
  }

  const characterClasses = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (password.length < PASSWORD_LONG_PHRASE_LENGTH && characterClasses < 3) {
    throw new Error(
      "Passwort braucht mindestens 3 Zeichenarten oder 14 Zeichen Laenge.",
    );
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await derivePasswordHash(password, salt);

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt,
    hash.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, n, r, p, salt, encodedHash] = storedHash.split("$");

  if (scheme !== "scrypt" || !n || !r || !p || !salt || !encodedHash) {
    return false;
  }

  const expectedHash = Buffer.from(encodedHash, "base64url");
  const actualHash = await derivePasswordHash(password, salt, {
    n: Number(n),
    p: Number(p),
    r: Number(r),
  });

  return (
    expectedHash.length === actualHash.length &&
    timingSafeEqual(expectedHash, actualHash)
  );
}

async function derivePasswordHash(
  password: string,
  salt: string,
  params: { n: number; p: number; r: number } = {
    n: SCRYPT_N,
    p: SCRYPT_P,
    r: SCRYPT_R,
  },
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: params.n,
        maxmem: SCRYPT_MAXMEM,
        p: params.p,
        r: params.r,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(Buffer.from(derivedKey));
      },
    );
  });
}

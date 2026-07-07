"use client";

import { useState } from "react";
import { Bike, Fingerprint, KeyRound } from "lucide-react";
import {
  arrayBufferToBase64Url,
  base64UrlToArrayBuffer,
} from "@/lib/webauthn/base64";

type LoginPanelProps = {
  nextPath: string;
};

type PublicKeyCredentialRequestOptionsJson = {
  allowCredentials: { id: string; type: "public-key" }[];
  challenge: string;
  rpId: string;
  timeout: number;
  userVerification: UserVerificationRequirement;
};

export function LoginPanel({ nextPath }: LoginPanelProps) {
  const [displayName, setDisplayName] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  async function loginWithPasskey() {
    setPasskeyError(null);

    if (!displayName.trim()) {
      setPasskeyError("Name fehlt.");
      return;
    }

    if (!window.PublicKeyCredential) {
      setPasskeyError("Dieses Gerät unterstützt keine Passkeys.");
      return;
    }

    setPasskeyLoading(true);

    try {
      const optionsResponse = await fetch("/api/passkeys/login/options", {
        body: JSON.stringify({ displayName }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const optionsPayload = (await optionsResponse.json()) as unknown;

      if (!optionsResponse.ok) {
        throw new Error(getResponseError(optionsPayload));
      }

      const options = optionsPayload as PublicKeyCredentialRequestOptionsJson;
      const credential = (await navigator.credentials.get({
        publicKey: {
          ...options,
          allowCredentials: options.allowCredentials.map((entry) => ({
            ...entry,
            id: base64UrlToArrayBuffer(entry.id),
          })),
          challenge: base64UrlToArrayBuffer(options.challenge),
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("Passkey-Anmeldung wurde abgebrochen.");
      }

      const assertion = credential.response as AuthenticatorAssertionResponse;
      const verifyResponse = await fetch("/api/passkeys/login/verify", {
        body: JSON.stringify({
          id: credential.id,
          rawId: arrayBufferToBase64Url(credential.rawId),
          response: {
            authenticatorData: arrayBufferToBase64Url(
              assertion.authenticatorData,
            ),
            clientDataJSON: arrayBufferToBase64Url(assertion.clientDataJSON),
            signature: arrayBufferToBase64Url(assertion.signature),
            userHandle: assertion.userHandle
              ? arrayBufferToBase64Url(assertion.userHandle)
              : null,
          },
          type: credential.type,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const verifyResult = (await verifyResponse.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!verifyResponse.ok) {
        throw new Error(
          verifyResult.error ?? "Passkey-Anmeldung fehlgeschlagen.",
        );
      }

      window.location.assign(nextPath || verifyResult.redirectTo || "/profile");
    } catch (error) {
      setPasskeyError(
        error instanceof Error
          ? error.message
          : "Passkey-Anmeldung fehlgeschlagen.",
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <form action="/api/auth/login" className="grid gap-4" method="post">
        <input name="next" type="hidden" value={nextPath} />
        <label className="grid gap-1 text-sm font-medium text-asphalt-800">
          Name
          <input
            autoComplete="username"
            className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3 text-base text-asphalt-900"
            name="displayName"
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-asphalt-800">
          Passwort
          <input
            autoComplete="current-password"
            className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3 text-base text-asphalt-900"
            name="password"
            required
            type="password"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white"
            type="submit"
          >
            <KeyRound aria-hidden className="h-4 w-4" />
            Mit Passwort anmelden
          </button>
          <button
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-4 text-sm font-semibold text-asphalt-900 disabled:cursor-not-allowed disabled:text-asphalt-400"
            disabled={passkeyLoading}
            onClick={loginWithPasskey}
            type="button"
          >
            <Fingerprint aria-hidden className="h-4 w-4" />
            {passkeyLoading ? "Prüfe Passkey" : "Mit Passkey anmelden"}
          </button>
          <a
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#fc4c02] px-4 text-sm font-semibold text-white"
            href="/api/strava/connect"
          >
            <Bike aria-hidden className="h-4 w-4" />
            Mit Strava anmelden
          </a>
        </div>
      </form>

      {passkeyError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {passkeyError}
        </p>
      ) : null}
    </section>
  );
}

function getResponseError(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Passkey-Anmeldung fehlgeschlagen.";
}

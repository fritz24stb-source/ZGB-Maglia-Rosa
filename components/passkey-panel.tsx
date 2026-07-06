"use client";

import { useState } from "react";
import { Fingerprint } from "lucide-react";
import {
  arrayBufferToBase64Url,
  base64UrlToArrayBuffer,
} from "@/lib/webauthn/base64";

type PasskeyPanelProps = {
  passkeyCount: number;
};

type CreationOptionsJson = {
  attestation: AttestationConveyancePreference;
  authenticatorSelection: AuthenticatorSelectionCriteria;
  challenge: string;
  excludeCredentials: { id: string; type: "public-key" }[];
  pubKeyCredParams: PublicKeyCredentialParameters[];
  rp: PublicKeyCredentialRpEntity;
  timeout: number;
  user: {
    displayName: string;
    id: string;
    name: string;
  };
};

type AttestationResponseWithPublicKey = AuthenticatorAttestationResponse & {
  getPublicKey?: () => ArrayBuffer | null;
  getPublicKeyAlgorithm?: () => number;
  getTransports?: () => string[];
};

export function PasskeyPanel({ passkeyCount }: PasskeyPanelProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function registerPasskey() {
    setError(null);
    setStatus(null);

    if (!window.PublicKeyCredential) {
      setError("Dieses Geraet unterstuetzt keine Passkeys.");
      return;
    }

    setLoading(true);

    try {
      const optionsResponse = await fetch("/api/passkeys/register/options", {
        method: "POST",
      });
      const optionsPayload = (await optionsResponse.json()) as unknown;

      if (!optionsResponse.ok) {
        throw new Error(getResponseError(optionsPayload));
      }

      const options = optionsPayload as CreationOptionsJson;
      const credential = (await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: base64UrlToArrayBuffer(options.challenge),
          excludeCredentials: options.excludeCredentials.map((entry) => ({
            ...entry,
            id: base64UrlToArrayBuffer(entry.id),
          })),
          user: {
            ...options.user,
            id: base64UrlToArrayBuffer(options.user.id),
          },
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("Passkey-Registrierung wurde abgebrochen.");
      }

      const attestation =
        credential.response as AttestationResponseWithPublicKey;
      const publicKey = attestation.getPublicKey?.();
      const publicKeyAlgorithm = attestation.getPublicKeyAlgorithm?.();

      if (!publicKey || typeof publicKeyAlgorithm !== "number") {
        throw new Error("Browser konnte den Passkey Public Key nicht liefern.");
      }

      const verifyResponse = await fetch("/api/passkeys/register/verify", {
        body: JSON.stringify({
          id: credential.id,
          rawId: arrayBufferToBase64Url(credential.rawId),
          response: {
            attestationObject: arrayBufferToBase64Url(
              attestation.attestationObject,
            ),
            clientDataJSON: arrayBufferToBase64Url(attestation.clientDataJSON),
            publicKey: arrayBufferToBase64Url(publicKey),
            publicKeyAlgorithm,
            transports: attestation.getTransports?.() ?? [],
          },
          type: credential.type,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const verifyResult = (await verifyResponse.json()) as { error?: string };

      if (!verifyResponse.ok) {
        throw new Error(
          verifyResult.error ?? "Passkey konnte nicht gespeichert werden.",
        );
      }

      setStatus("Passkey wurde gespeichert.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Passkey konnte nicht gespeichert werden.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-asphalt-100 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-asphalt-900">Passkeys</h3>
          <p className="mt-1 text-sm text-asphalt-600">
            Gespeicherte Passkeys: {passkeyCount}
          </p>
        </div>
        <button
          className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800 disabled:cursor-not-allowed disabled:text-asphalt-400"
          disabled={loading}
          onClick={registerPasskey}
          type="button"
        >
          <Fingerprint aria-hidden className="h-4 w-4" />
          {loading ? "Speichere" : "Passkey erstellen"}
        </button>
      </div>
      {status ? (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
    </div>
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

  return "Passkey-Registrierung konnte nicht gestartet werden.";
}

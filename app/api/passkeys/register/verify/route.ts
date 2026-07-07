import { NextResponse, type NextRequest } from "next/server";
import { requireActiveAppUser } from "@/lib/auth/guards";
import { isUniqueViolation } from "@/lib/auth/app-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  PASSKEY_REGISTER_STATE_COOKIE,
  readPasskeyStateCookieValue,
  validateClientData,
} from "@/lib/webauthn/server";

type PasskeyRegisterPayload = {
  id?: unknown;
  rawId?: unknown;
  response?: {
    attestationObject?: unknown;
    clientDataJSON?: unknown;
    publicKey?: unknown;
    publicKeyAlgorithm?: unknown;
    transports?: unknown;
  };
  type?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await requireActiveAppUser();
    const state = readPasskeyStateCookieValue(
      request.cookies.get(PASSKEY_REGISTER_STATE_COOKIE)?.value,
      "register",
    );

    if (!state || state.userId !== access.userId) {
      throw new Error("Passkey-Registrierung ist abgelaufen.");
    }

    const payload = (await request.json()) as PasskeyRegisterPayload;
    const rawId = requireString(payload.rawId, "Passkey-ID fehlt.");
    const clientDataJSON = requireString(
      payload.response?.clientDataJSON,
      "Passkey-Clientdaten fehlen.",
    );
    const publicKey = requireString(
      payload.response?.publicKey,
      "Passkey Public Key fehlt.",
    );
    const publicKeyAlgorithm = requireNumber(
      payload.response?.publicKeyAlgorithm,
      "Passkey-Algorithmus fehlt.",
    );
    const transports = Array.isArray(payload.response?.transports)
      ? payload.response.transports.filter(
          (transport): transport is string => typeof transport === "string",
        )
      : null;

    if (payload.type !== "public-key") {
      throw new Error("Ungültiger Passkey-Typ.");
    }

    validateClientData({
      challenge: state.challenge,
      clientDataJSON,
      expectedType: "webauthn.create",
    });

    const serviceClient = createSupabaseServiceRoleClient();
    const { error } = await serviceClient
      .from("app_passkey_credentials")
      .insert({
        algorithm: publicKeyAlgorithm,
        credential_id: rawId,
        name: "Passkey",
        public_key_spki: publicKey,
        sign_count: 0,
        transports,
        user_id: access.userId,
      });

    if (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Dieser Passkey ist bereits registriert.");
      }

      throw error;
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(PASSKEY_REGISTER_STATE_COOKIE, "", {
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: formatPasskeyError(error) },
      { status: 400 },
    );
  }
}

function requireString(value: unknown, message: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(message);
  }

  return value;
}

function requireNumber(value: unknown, message: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(message);
  }

  return value;
}

function formatPasskeyError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Passkey konnte nicht registriert werden.";
}

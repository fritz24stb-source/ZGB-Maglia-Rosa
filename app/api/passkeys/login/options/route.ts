import { NextResponse, type NextRequest } from "next/server";
import { findProfileByDisplayName } from "@/lib/auth/app-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createPasskeyStateCookieValue,
  generateWebAuthnChallenge,
  getWebAuthnRpId,
  PASSKEY_LOGIN_STATE_COOKIE,
  PASSKEY_STATE_MAX_AGE_SECONDS,
} from "@/lib/webauthn/server";

type PasskeyLoginOptionsPayload = {
  displayName?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as PasskeyLoginOptionsPayload;
    const displayName = requireString(payload.displayName, "Name fehlt.");
    const serviceClient = createSupabaseServiceRoleClient();
    const profile = await findProfileByDisplayName(serviceClient, displayName);

    if (!profile || !profile.is_active) {
      throw new Error("Kein aktiver Passkey fuer diesen Namen gefunden.");
    }

    const { data, error } = await serviceClient
      .from("app_passkey_credentials")
      .select("credential_id")
      .eq("user_id", profile.id);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error("Kein aktiver Passkey fuer diesen Namen gefunden.");
    }

    const challenge = generateWebAuthnChallenge();
    const response = NextResponse.json({
      allowCredentials: data.map((credential) => ({
        id: credential.credential_id,
        type: "public-key",
      })),
      challenge,
      rpId: getWebAuthnRpId(),
      timeout: 60000,
      userVerification: "required",
    });

    response.cookies.set(
      PASSKEY_LOGIN_STATE_COOKIE,
      createPasskeyStateCookieValue({
        challenge,
        type: "login",
        userId: profile.id,
      }),
      {
        httpOnly: true,
        maxAge: PASSKEY_STATE_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
      },
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: formatPasskeyError(error) },
      { status: 400 },
    );
  }
}

function requireString(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function formatPasskeyError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Passkey-Anmeldung konnte nicht gestartet werden.";
}

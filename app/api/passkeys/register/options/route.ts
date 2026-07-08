import { NextResponse, type NextRequest } from "next/server";
import { requireActiveAppUser } from "@/lib/auth/guards";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  buildUserHandle,
  createPasskeyStateCookieValue,
  generateWebAuthnChallenge,
  getWebAuthnRpId,
  PASSKEY_REGISTER_STATE_COOKIE,
  PASSKEY_STATE_MAX_AGE_SECONDS,
} from "@/lib/webauthn/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await requireActiveAppUser();
    const serviceClient = createSupabaseServiceRoleClient();
    const { data, error } = await serviceClient
      .from("app_passkey_credentials")
      .select("credential_id")
      .eq("user_id", access.userId);

    if (error) {
      throw error;
    }

    const challenge = generateWebAuthnChallenge();
    const response = NextResponse.json({
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      challenge,
      excludeCredentials: (data ?? []).map((credential) => ({
        id: credential.credential_id,
        type: "public-key",
      })),
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      rp: {
        id: getWebAuthnRpId(),
        name: "ZGB-Maglia-Rosa",
      },
      timeout: 60000,
      user: {
        displayName: access.profile.display_name,
        id: buildUserHandle(access.userId),
        name: access.profile.display_name,
      },
    });

    response.cookies.set(
      PASSKEY_REGISTER_STATE_COOKIE,
      createPasskeyStateCookieValue({
        challenge,
        type: "register",
        userId: access.userId,
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

function formatPasskeyError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Passkey-Registrierung konnte nicht gestartet werden.";
}

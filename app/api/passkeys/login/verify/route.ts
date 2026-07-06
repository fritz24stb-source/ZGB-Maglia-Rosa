import { NextResponse, type NextRequest } from "next/server";
import { signInSupabaseAsAppUser } from "@/lib/auth/app-auth";
import { setAppSessionCookie } from "@/lib/auth/app-session";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import {
  parseAuthenticatorData,
  PASSKEY_LOGIN_STATE_COOKIE,
  readPasskeyStateCookieValue,
  validateClientData,
  verifyPasskeySignature,
} from "@/lib/webauthn/server";
import type { Database } from "@/types/database";

type PasskeyLoginPayload = {
  rawId?: unknown;
  response?: {
    authenticatorData?: unknown;
    clientDataJSON?: unknown;
    signature?: unknown;
    userHandle?: unknown;
  };
  type?: unknown;
};

type PasskeyRow =
  Database["public"]["Tables"]["app_passkey_credentials"]["Row"];
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id" | "is_active"
>;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const state = readPasskeyStateCookieValue(
      request.cookies.get(PASSKEY_LOGIN_STATE_COOKIE)?.value,
      "login",
    );

    if (!state) {
      throw new Error("Passkey-Anmeldung ist abgelaufen.");
    }

    const payload = (await request.json()) as PasskeyLoginPayload;
    const rawId = requireString(payload.rawId, "Passkey-ID fehlt.");
    const clientDataJSON = requireString(
      payload.response?.clientDataJSON,
      "Passkey-Clientdaten fehlen.",
    );
    const authenticatorData = requireString(
      payload.response?.authenticatorData,
      "Passkey-Authenticatordaten fehlen.",
    );
    const signature = requireString(
      payload.response?.signature,
      "Passkey-Signatur fehlt.",
    );

    if (payload.type !== "public-key") {
      throw new Error("Ungueltiger Passkey-Typ.");
    }

    validateClientData({
      challenge: state.challenge,
      clientDataJSON,
      expectedType: "webauthn.get",
    });

    const parsedAuthenticatorData = parseAuthenticatorData(authenticatorData);

    if (
      !parsedAuthenticatorData.userPresent ||
      !parsedAuthenticatorData.userVerified
    ) {
      throw new Error("Passkey wurde nicht per Geraetefreigabe bestaetigt.");
    }

    const serviceClient = createSupabaseServiceRoleClient();
    const [credentialResult, profileResult] = await Promise.all([
      serviceClient
        .from("app_passkey_credentials")
        .select("*")
        .eq("credential_id", rawId)
        .eq("user_id", state.userId)
        .maybeSingle(),
      serviceClient
        .from("profiles")
        .select("id, display_name, is_active")
        .eq("id", state.userId)
        .maybeSingle(),
    ]);

    if (credentialResult.error || profileResult.error) {
      throw credentialResult.error ?? profileResult.error;
    }

    const credential = credentialResult.data as PasskeyRow | null;
    const profile = profileResult.data as ProfileRow | null;

    if (!credential || !profile || !profile.is_active) {
      throw new Error("Passkey-Anmeldung ist nicht erlaubt.");
    }

    if (
      credential.sign_count > 0 &&
      parsedAuthenticatorData.signCount > 0 &&
      parsedAuthenticatorData.signCount <= credential.sign_count
    ) {
      throw new Error("Passkey-Signaturzaehler ist ungueltig.");
    }

    const signatureValid = verifyPasskeySignature({
      algorithm: credential.algorithm,
      authenticatorData,
      clientDataJSON,
      publicKeySpki: credential.public_key_spki,
      signature,
    });

    if (!signatureValid) {
      throw new Error("Passkey-Signatur ist ungueltig.");
    }

    const updateResult = await serviceClient
      .from("app_passkey_credentials")
      .update({
        last_used_at: new Date().toISOString(),
        sign_count: Math.max(
          credential.sign_count,
          parsedAuthenticatorData.signCount,
        ),
      })
      .eq("id", credential.id);

    if (updateResult.error) {
      throw updateResult.error;
    }

    const serverClient = await createSupabaseServerClient();
    await signInSupabaseAsAppUser({
      displayName: profile.display_name,
      serviceClient,
      serverClient,
      userId: profile.id,
    });

    const response = NextResponse.json({ redirectTo: "/profile" });
    await setAppSessionCookie(response, profile.id, request.url);
    response.cookies.set(PASSKEY_LOGIN_STATE_COOKIE, "", {
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

function formatPasskeyError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Passkey-Anmeldung fehlgeschlagen.";
}

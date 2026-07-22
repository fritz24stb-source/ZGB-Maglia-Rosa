import { NextResponse, type NextRequest } from "next/server";
import {
  assertDisplayNameAvailable,
  createAppAuthUser,
  isUniqueViolation,
  signInSupabaseAsAppUser,
} from "@/lib/auth/app-auth";
import { setAppSessionCookie } from "@/lib/auth/app-session";
import {
  assertInviteCanBeUsed,
  consumeInvite,
  loadInviteByToken,
  normalizeInviteToken,
} from "@/lib/auth/invites";
import { normalizeDisplayName } from "@/lib/auth/names";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { buildRegistrationAdminNotification } from "@/lib/auth/registration-notification";
import { getAppBaseUrl } from "@/lib/env";
import { logError } from "@/lib/logger";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const inviteToken = getFormText(formData, "invite", "Einladungscode fehlt.");

  try {
    validateOrigin(request);

    const displayName = normalizeDisplayName(
      getFormText(formData, "displayName", "Name fehlt."),
    );
    const password = getFormText(formData, "password", "Passwort fehlt.");
    const passwordConfirm = getFormText(
      formData,
      "passwordConfirm",
      "Passwortbestätigung fehlt.",
    );

    if (password !== passwordConfirm) {
      throw new Error("Passwörter stimmen nicht überein.");
    }

    validatePasswordPolicy(password, displayName);

    const normalizedInviteToken = normalizeInviteToken(inviteToken);
    const serviceClient = createSupabaseServiceRoleClient();
    const invite = await loadInviteByToken(
      serviceClient,
      normalizedInviteToken,
    );
    assertInviteCanBeUsed(invite);
    await assertDisplayNameAvailable(serviceClient, displayName);

    let createdUserId: string | null = null;

    try {
      createdUserId = await createAppAuthUser(serviceClient, displayName);

      const profileResult = await serviceClient.from("profiles").insert({
        id: createdUserId,
        display_name: displayName,
        role: "member",
        is_active: true,
      });

      if (profileResult.error) {
        if (isUniqueViolation(profileResult.error)) {
          throw new Error("Dieser Name ist bereits vergeben.");
        }

        throw profileResult.error;
      }

      const credentialResult = await serviceClient
        .from("app_user_credentials")
        .insert({
          user_id: createdUserId,
          password_hash: await hashPassword(password),
        });

      if (credentialResult.error) {
        throw credentialResult.error;
      }

      await consumeInvite(serviceClient, invite!.id, createdUserId);

      const notificationResult = await serviceClient
        .from("admin_notifications")
        .insert(
          buildRegistrationAdminNotification({
            displayName,
            userId: createdUserId,
          }),
        );

      if (notificationResult.error) {
        logError(
          "auth.registration_admin_notification.failed",
          notificationResult.error,
          { userId: createdUserId },
        );
      }

      const serverClient = await createSupabaseServerClient();
      await signInSupabaseAsAppUser({
        displayName,
        serviceClient,
        serverClient,
        userId: createdUserId,
      });

      const url = new URL("/profile", request.url);
      url.searchParams.set("registered", "1");

      const response = NextResponse.redirect(url, { status: 303 });
      await setAppSessionCookie(response, createdUserId, request.url);

      return response;
    } catch (error) {
      if (createdUserId) {
        await serviceClient.auth.admin.deleteUser(createdUserId).catch(() => {
          // Best-effort cleanup for a failed registration transaction.
        });
      }

      throw error;
    }
  } catch (error) {
    return redirectToRegister(request, inviteToken, formatAuthFormError(error));
  }
}

function validateOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  if (origin !== new URL(getAppBaseUrl()).origin) {
    throw new Error("Ungültiger Request-Origin.");
  }
}

function getFormText(formData: FormData, key: string, message: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function redirectToRegister(
  request: NextRequest,
  inviteToken: string,
  error: string,
) {
  const url = new URL("/register", request.url);

  if (inviteToken.trim()) {
    url.searchParams.set("invite", inviteToken.trim());
  }

  url.searchParams.set("error", error);

  return NextResponse.redirect(url, { status: 303 });
}

function formatAuthFormError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return "Server-Konfiguration ist unvollstaendig.";
  }

  return error instanceof Error
    ? error.message
    : "Registrierung konnte nicht abgeschlossen werden.";
}

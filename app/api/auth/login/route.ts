import { NextResponse, type NextRequest } from "next/server";
import {
  findProfileByDisplayName,
  getPasswordCredential,
  signInSupabaseAsAppUser,
} from "@/lib/auth/app-auth";
import { setAppSessionCookie } from "@/lib/auth/app-session";
import { verifyPassword } from "@/lib/auth/password";
import { getAppBaseUrl } from "@/lib/env";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const nextPath = normalizeAppNextPath(getOptionalFormText(formData, "next"));

  try {
    validateOrigin(request);

    const displayName = getFormText(formData, "displayName", "Name fehlt.");
    const password = getFormText(formData, "password", "Passwort fehlt.");
    const serviceClient = createSupabaseServiceRoleClient();
    const profile = await findProfileByDisplayName(serviceClient, displayName);

    if (!profile || !profile.is_active) {
      throw new Error("Name oder Passwort ist falsch.");
    }

    const credential = await getPasswordCredential(serviceClient, profile.id);

    if (
      !credential ||
      !(await verifyPassword(password, credential.password_hash))
    ) {
      throw new Error("Name oder Passwort ist falsch.");
    }

    const serverClient = await createSupabaseServerClient();
    await signInSupabaseAsAppUser({
      displayName: profile.display_name,
      serviceClient,
      serverClient,
      userId: profile.id,
    });

    const response = NextResponse.redirect(new URL(nextPath, request.url), {
      status: 303,
    });
    await setAppSessionCookie(response, profile.id, request.url);

    return response;
  } catch (error) {
    return redirectToLogin(request, nextPath, formatLoginError(error));
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
  const value = getOptionalFormText(formData, key);

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getOptionalFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeAppNextPath(value: string | null) {
  if (
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/api")
  ) {
    return value;
  }

  return "/profile";
}

function redirectToLogin(
  request: NextRequest,
  nextPath: string,
  error: string,
) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", nextPath);
  url.searchParams.set("error", error);

  return NextResponse.redirect(url, { status: 303 });
}

function formatLoginError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return "Server-Konfiguration ist unvollstaendig.";
  }

  return error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.";
}

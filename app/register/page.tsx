import Link from "next/link";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  assertInviteCanBeUsed,
  loadInviteByToken,
  normalizeInviteToken,
} from "@/lib/auth/invites";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InviteState =
  | { kind: "manual" }
  | { kind: "valid"; token: string }
  | { kind: "invalid"; message: string; token: string };

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const params = searchParams ? await searchParams : {};
  const inviteToken = getSingleParam(params.invite);
  const error = getSingleParam(params.error);
  const inviteState = await loadInviteState(inviteToken);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Registrieren"
        description="Profil mit Einladungscode erstellen. Strava wird danach im Profil verknuepft."
      />

      {error ? (
        <StatusMessage
          icon={<AlertTriangle aria-hidden className="h-5 w-5" />}
          message={error}
          tone="danger"
        />
      ) : null}

      {inviteState.kind === "valid" ? (
        <StatusMessage
          icon={<CheckCircle2 aria-hidden className="h-5 w-5" />}
          message="Einladung ist gültig."
          tone="success"
        />
      ) : null}

      {inviteState.kind === "invalid" ? (
        <StatusMessage
          icon={<AlertTriangle aria-hidden className="h-5 w-5" />}
          message={inviteState.message}
          tone="danger"
        />
      ) : null}

      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <form action="/api/auth/register" className="grid gap-4" method="post">
          {inviteState.kind === "valid" ? (
            <input name="invite" type="hidden" value={inviteState.token} />
          ) : (
            <label className="grid gap-1 text-sm font-medium text-asphalt-800">
              Einladungscode
              <input
                autoComplete="one-time-code"
                className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3 text-base text-asphalt-900"
                defaultValue={
                  inviteState.kind === "invalid" ? inviteState.token : ""
                }
                name="invite"
                required
              />
            </label>
          )}

          <label className="grid gap-1 text-sm font-medium text-asphalt-800">
            Name
            <input
              autoComplete="username"
              className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3 text-base text-asphalt-900"
              name="displayName"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-asphalt-800">
            Passwort
            <input
              autoComplete="new-password"
              className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3 text-base text-asphalt-900"
              name="password"
              required
              type="password"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-asphalt-800">
            Passwort bestätigen
            <input
              autoComplete="new-password"
              className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3 text-base text-asphalt-900"
              name="passwordConfirm"
              required
              type="password"
            />
          </label>
          <p className="text-sm leading-6 text-asphalt-600">
            Mindestens 10 Zeichen. Unter 14 Zeichen braucht es 3 Zeichenarten.
            Lange Passwortsaetze sind erlaubt.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-asphalt-300"
              disabled={inviteState.kind === "invalid"}
              type="submit"
            >
              <UserPlus aria-hidden className="h-4 w-4" />
              Profil erstellen
            </button>
            <Link
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-asphalt-300 px-4 text-sm font-semibold text-asphalt-900"
              href="/login"
            >
              Zur Anmeldung
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

async function loadInviteState(
  token: string | undefined,
): Promise<InviteState> {
  if (!token) {
    return { kind: "manual" };
  }

  try {
    const normalizedToken = normalizeInviteToken(token);
    const serviceClient = createSupabaseServiceRoleClient();
    const invite = await loadInviteByToken(serviceClient, normalizedToken);
    assertInviteCanBeUsed(invite);

    return { kind: "valid", token: normalizedToken };
  } catch (error) {
    return {
      kind: "invalid",
      message:
        error instanceof Error ? error.message : "Einladung ist ungültig.",
      token,
    };
  }
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StatusMessage({
  icon,
  message,
  tone,
}: {
  icon: React.ReactNode;
  message: string;
  tone: "danger" | "success";
}) {
  const toneClasses = {
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-green-200 bg-green-50 text-green-900",
  };

  return (
    <section className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <div className="flex gap-3">
        <div className="mt-0.5">{icon}</div>
        <p className="text-sm leading-6">{message}</p>
      </div>
    </section>
  );
}

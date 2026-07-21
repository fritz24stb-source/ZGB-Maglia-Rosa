import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Link2Off,
  LogOut,
  PlugZap,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PasskeyPanel } from "@/components/passkey-panel";
import { StatusBadge } from "@/components/status-badge";
import { requireActiveAppPage } from "@/lib/auth/page-guard";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProfileState =
  | { kind: "anonymous" }
  | { kind: "unconfigured"; message: string }
  | {
      kind: "authenticated";
      profileName: string;
      role: "admin" | "member";
      connection: {
        athleteId: number;
        expiresAt: string | null;
        revoked: boolean;
        scope: string | null;
      } | null;
      passkeyCount: number;
      activities: {
        id: string;
        activity_name: string;
        points: number;
        status: "active" | "ignored" | "deleted";
        activity_started_local_at: string | null;
        activity_started_at: string;
      }[];
    };

type ProfileSummary = {
  display_name: string;
  role: "admin" | "member";
};

type ConnectionSummary = {
  strava_athlete_id: number;
  expires_at: string | null;
  scope: string | null;
  revoked: boolean;
};

type ActivitySummary = Extract<
  ProfileState,
  { kind: "authenticated" }
>["activities"][number];

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const accessBlocked = await requireActiveAppPage("/profile");

  if (accessBlocked) {
    return accessBlocked;
  }

  const params = searchParams ? await searchParams : {};
  const connected = getSingleParam(params.connected);
  const error = getSingleParam(params.error);
  const registered = getSingleParam(params.registered);
  const state = await loadProfileState();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Profil"
        description="Eigener Verbindungsstatus und letzte gewertete Aktivitäten."
      />

      {connected ? (
        <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Strava wurde verbunden. Neue Aktivitäten werden anschließend per
          Webhook verarbeitet.
        </section>
      ) : null}

      {registered ? (
        <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Registrierung abgeschlossen. Strava kann jetzt verknuepft und ein
          Passkey für schnelle Anmeldung erstellt werden.
        </section>
      ) : null}

      {error === "disconnect_failed" ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Strava konnte nicht getrennt werden. Bitte später erneut versuchen.
        </section>
      ) : null}

      {error === "purge_failed" ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Strava-Daten konnten nicht bereinigt werden. Bitte spaeter erneut
          versuchen.
        </section>
      ) : null}

      {getSingleParam(params.purged) ? (
        <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Strava-bezogene Detaildaten wurden bereinigt. Aggregierte
          Wertungsdaten bleiben erhalten.
        </section>
      ) : null}

      {state.kind === "unconfigured" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle aria-hidden className="h-5 w-5" />
            <p>{state.message}</p>
          </div>
        </section>
      ) : null}

      {state.kind === "anonymous" ? <AnonymousProfile /> : null}

      {state.kind === "authenticated" ? (
        <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-asphalt-900">
                  {state.profileName}
                </h2>
                <p className="mt-1 text-sm text-asphalt-600">
                  Rolle: {state.role === "admin" ? "Admin" : "Mitglied"}
                </p>
              </div>
              <StatusBadge tone={state.role === "admin" ? "info" : "neutral"}>
                {state.role}
              </StatusBadge>
            </div>

            <div className="mt-6 border-t border-asphalt-100 pt-5">
              <h3 className="text-sm font-semibold text-asphalt-900">
                Strava-Verbindung
              </h3>
              <ConnectionStatus connection={state.connection} />
            </div>

            <PasskeyPanel passkeyCount={state.passkeyCount} />

            <p className="mt-6 text-sm text-asphalt-500">
              Hinweise zu Strava-Daten und Loeschung stehen unter{" "}
              <Link
                className="focus-ring rounded-sm text-signal-blue"
                href="/datenschutz"
              >
                Datenschutz
              </Link>
              .
            </p>

            <form action="/api/strava/purge" className="mt-4" method="post">
              <button
                type="submit"
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-800"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                Strava-Daten bereinigen
              </button>
            </form>

            <form action="/api/auth/logout" className="mt-6" method="post">
              <button
                type="submit"
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                Abmelden
              </button>
            </form>
          </article>

          <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
            <div className="flex items-center gap-2">
              <Activity aria-hidden className="h-5 w-5 text-signal-blue" />
              <h2 className="text-base font-semibold text-asphalt-900">
                Letzte Aktivitäten
              </h2>
            </div>
            <ActivityList activities={state.activities} />
          </article>
        </section>
      ) : null}
    </main>
  );
}

function AnonymousProfile() {
  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <UserRound aria-hidden className="mt-1 h-5 w-5 text-signal-blue" />
          <div>
            <h2 className="text-base font-semibold text-asphalt-900">
              Nicht angemeldet
            </h2>
            <p className="mt-1 text-sm leading-6 text-asphalt-600">
              Verbinde Strava, damit ein Mitgliedsprofil angelegt wird.
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
        >
          Zur Anmeldung
        </Link>
      </div>
    </section>
  );
}

function ConnectionStatus({
  connection,
}: {
  connection: Extract<ProfileState, { kind: "authenticated" }>["connection"];
}) {
  if (!connection) {
    return (
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusBadge tone="neutral">Nicht verbunden</StatusBadge>
        <a
          href="/api/strava/connect"
          className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#fc4c02] px-3 text-sm font-semibold text-white"
        >
          <PlugZap aria-hidden className="h-4 w-4" />
          Strava verbinden
        </a>
      </div>
    );
  }

  if (connection.revoked) {
    return (
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <StatusBadge tone="danger">Widerrufen</StatusBadge>
          <p className="text-xs text-asphalt-500">
            Athlete ID: {connection.athleteId}
          </p>
        </div>
        <a
          href="/api/strava/connect"
          className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#fc4c02] px-3 text-sm font-semibold text-white"
        >
          <RefreshCw aria-hidden className="h-4 w-4" />
          Erneut verbinden
        </a>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="success">Verbunden</StatusBadge>
        <span className="text-xs text-asphalt-500">
          Athlete ID: {connection.athleteId}
        </span>
      </div>
      <dl className="grid gap-2 text-sm text-asphalt-600">
        <div>
          <dt className="text-xs font-semibold uppercase text-asphalt-500">
            Token Ablauf
          </dt>
          <dd>
            {connection.expiresAt ? formatDate(connection.expiresAt) : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-asphalt-500">
            Scope
          </dt>
          <dd>{connection.scope ?? "-"}</dd>
        </div>
      </dl>
      <form action="/api/strava/disconnect" method="post">
        <button
          type="submit"
          className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
        >
          <Link2Off aria-hidden className="h-4 w-4" />
          Strava trennen
        </button>
      </form>
    </div>
  );
}

function ActivityList({
  activities,
}: {
  activities: Extract<ProfileState, { kind: "authenticated" }>["activities"];
}) {
  if (activities.length === 0) {
    return (
      <p className="mt-4 text-sm leading-6 text-asphalt-600">
        Noch keine gespeicherten Aktivitäten vorhanden.
      </p>
    );
  }

  return (
    <div className="mt-4 max-h-96 overflow-y-auto overflow-x-hidden rounded-md border border-asphalt-100">
      <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
        <thead className="sticky top-0 z-10 bg-asphalt-50 text-xs uppercase text-asphalt-600">
          <tr>
            <th className="w-[34%] px-2 py-2 font-semibold sm:px-3">
              Aktivität
            </th>
            <th className="w-[28%] px-2 py-2 font-semibold sm:px-3">
              Datum
            </th>
            <th className="w-[23%] px-2 py-2 font-semibold sm:px-3">
              Status
            </th>
            <th className="w-[15%] px-2 py-2 text-right font-semibold sm:px-3">
              Punkte
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-asphalt-100">
          {activities.map((activity) => (
            <tr key={activity.id}>
              <td className="break-words px-2 py-3 font-medium text-asphalt-900 sm:px-3">
                {activity.activity_name}
              </td>
              <td className="break-words px-2 py-3 text-xs leading-5 text-asphalt-500 sm:px-3">
                {formatDate(
                  activity.activity_started_local_at ??
                    activity.activity_started_at,
                )}
              </td>
              <td className="px-2 py-3 sm:px-3">
                <StatusBadge
                  tone={
                    activity.status === "active"
                      ? "success"
                      : activity.status === "ignored"
                        ? "warning"
                        : "danger"
                  }
                >
                  {activity.status}
                </StatusBadge>
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right font-semibold text-asphalt-900 sm:px-3">
                {activity.points} P
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function loadProfileState(): Promise<ProfileState> {
  try {
    const accessState = await loadCurrentAppAccessState();

    if (accessState.kind !== "active") {
      return { kind: "anonymous" };
    }

    const supabase = createSupabaseServiceRoleClient();
    const userId = accessState.userId;
    const [profileResult, connectionResult, activities] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, role")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("strava_connections")
        .select("strava_athlete_id, expires_at, scope, revoked")
        .eq("user_id", userId)
        .maybeSingle(),
      loadAllScoredActivities(supabase, userId),
    ]);
    const passkeysResult = await supabase
      .from("app_passkey_credentials")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (passkeysResult.error) {
      throw passkeysResult.error;
    }

    if (profileResult.error || connectionResult.error) {
      throw profileResult.error ?? connectionResult.error;
    }

    const profile = profileResult.data as ProfileSummary | null;
    const connection = connectionResult.data as ConnectionSummary | null;
    return {
      kind: "authenticated",
      profileName:
        profile?.display_name ?? accessState.profile.display_name ?? "Mitglied",
      role: profile?.role ?? "member",
      passkeyCount: passkeysResult.count ?? 0,
      connection: connection
        ? {
            athleteId: connection.strava_athlete_id,
            expiresAt: connection.expires_at,
            revoked: connection.revoked,
            scope: connection.scope,
          }
        : null,
      activities,
    };
  } catch (error) {
    return {
      kind: "unconfigured",
      message: formatProfileLoadError(error),
    };
  }
}

async function loadAllScoredActivities(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
) {
  const pageSize = 1000;
  const activities: ActivitySummary[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("activities")
      .select(
        "id, activity_name, points, status, activity_started_local_at, activity_started_at",
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("points", 0)
      .not("matched_rule_id", "is", null)
      .order("activity_started_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as ActivitySummary[];
    activities.push(...page);

    if (page.length < pageSize) {
      return activities;
    }
  }
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatProfileLoadError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return [
      "Supabase ist lokal noch nicht konfiguriert.",
      "Lege eine .env.local auf Basis von .env.example an und setze mindestens NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY.",
    ].join(" ");
  }

  return error instanceof Error
    ? error.message
    : "Profilstatus konnte nicht geladen werden.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

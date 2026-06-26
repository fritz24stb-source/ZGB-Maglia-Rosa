import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Link2Off,
  PlugZap,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const params = searchParams ? await searchParams : {};
  const connected = getSingleParam(params.connected);
  const error = getSingleParam(params.error);
  const state = await loadProfileState();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Profil"
        description="Eigener Verbindungsstatus und letzte gewertete Aktivitaeten."
      />

      {connected ? (
        <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Strava wurde verbunden. Neue Aktivitaeten werden anschliessend per
          Webhook verarbeitet.
        </section>
      ) : null}

      {error === "disconnect_failed" ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Strava konnte nicht getrennt werden. Bitte spaeter erneut versuchen.
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
          </article>

          <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
            <div className="flex items-center gap-2">
              <Activity aria-hidden className="h-5 w-5 text-signal-blue" />
              <h2 className="text-base font-semibold text-asphalt-900">
                Letzte Aktivitaeten
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
        Noch keine gespeicherten Aktivitaeten vorhanden.
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-asphalt-100">
      {activities.map((activity) => (
        <li key={activity.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-asphalt-900">
                {activity.activity_name}
              </p>
              <p className="mt-1 text-xs text-asphalt-500">
                {formatDate(
                  activity.activity_started_local_at ??
                    activity.activity_started_at,
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
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
              <span className="text-sm font-semibold text-asphalt-900">
                {activity.points} P
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function loadProfileState(): Promise<ProfileState> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { kind: "anonymous" };
    }

    const [profileResult, connectionResult, activitiesResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, role")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("strava_connections")
          .select("strava_athlete_id, expires_at, scope, revoked")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("activities")
          .select(
            "id, activity_name, points, status, activity_started_local_at, activity_started_at",
          )
          .eq("user_id", user.id)
          .order("activity_started_at", { ascending: false })
          .limit(5),
      ]);

    if (
      profileResult.error ||
      connectionResult.error ||
      activitiesResult.error
    ) {
      throw (
        profileResult.error ?? connectionResult.error ?? activitiesResult.error
      );
    }

    const profile = profileResult.data as ProfileSummary | null;
    const connection = connectionResult.data as ConnectionSummary | null;
    const activities = (activitiesResult.data ?? []) as ActivitySummary[];

    return {
      kind: "authenticated",
      profileName: profile?.display_name ?? user.email ?? "Mitglied",
      role: profile?.role ?? "member",
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

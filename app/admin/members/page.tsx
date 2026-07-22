import {
  ChevronDown,
  RefreshCcw,
  Save,
  ShieldX,
  Trash2,
  Users,
} from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminMembersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];
type ConnectionRow = Pick<
  Database["public"]["Tables"]["strava_connections"]["Row"],
  "expires_at" | "revoked" | "scope" | "strava_athlete_id" | "user_id"
>;
type ActivityMiniRow = Pick<
  Database["public"]["Tables"]["activities"]["Row"],
  "matched_rule_id" | "points" | "status" | "user_id"
>;
type PointAdjustmentRow =
  Database["public"]["Tables"]["member_point_adjustments"]["Row"];

type MemberStats = {
  activeActivities: number;
  ignoredActivities: number;
  points: number;
};

const ACTIVITY_PAGE_SIZE = 1000;

type MembersState =
  | {
      kind: "ready";
      activityStats: Map<string, MemberStats>;
      activeAdminCount: number;
      adjustments: Map<string, PointAdjustmentRow[]>;
      connections: Map<string, ConnectionRow>;
      profiles: ProfileRow[];
      seasons: SeasonRow[];
    }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({
  searchParams,
}: AdminMembersPageProps) {
  const params = searchParams ? await searchParams : {};
  const state = await loadMembersState();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Mitgliederverwaltung"
        description="Mitgliederstatus, Rollen, Strava-Verbindungen und User-Resync verwalten."
      />
      <AdminFlash
        error={getSingleParam(params.adminError)}
        status={getSingleParam(params.adminStatus)}
      />

      {state.kind === "error" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {state.message}
        </section>
      ) : (
        <section className="grid gap-3">
          {state.profiles.map((profile) => (
            <MemberCard
              key={profile.id}
              connection={state.connections.get(profile.id) ?? null}
              adjustments={state.adjustments.get(profile.id) ?? []}
              isLastActiveAdmin={
                profile.role === "admin" &&
                profile.is_active &&
                state.activeAdminCount <= 1
              }
              profile={profile}
              seasons={state.seasons}
              stats={state.activityStats.get(profile.id) ?? emptyStats}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function MemberCard({
  adjustments,
  connection,
  isLastActiveAdmin,
  profile,
  seasons,
  stats,
}: {
  adjustments: PointAdjustmentRow[];
  connection: ConnectionRow | null;
  isLastActiveAdmin: boolean;
  profile: ProfileRow;
  seasons: SeasonRow[];
  stats: MemberStats;
}) {
  const adjustmentPoints = adjustments.reduce(
    (sum, adjustment) => sum + adjustment.points,
    0,
  );

  return (
    <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <details className="group min-w-0 flex-1">
          <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-start justify-between gap-3 rounded-md [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-asphalt-900">
                  {profile.display_name}
                </h2>
                <StatusBadge tone={profile.is_active ? "success" : "warning"}>
                  {profile.is_active ? "Aktiv" : "Inaktiv"}
                </StatusBadge>
                <StatusBadge
                  tone={profile.role === "admin" ? "info" : "neutral"}
                >
                  {profile.role}
                </StatusBadge>
                <StravaBadge connection={connection} />
              </div>
            </div>
            <ChevronDown
              aria-hidden
              className="mt-1 h-4 w-4 shrink-0 text-asphalt-500 transition-transform group-open:rotate-180"
            />
          </summary>

          <div className="mt-4 border-t border-asphalt-100 pt-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <form
                action={`/api/admin/members/${profile.id}`}
                method="post"
                className="grid flex-1 gap-4 md:grid-cols-[1.3fr_0.7fr_auto]"
              >
                <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
                  Name
                  <input
                    className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                    defaultValue={profile.display_name}
                    name="displayName"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
                  Rolle
                  <select
                    className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                    defaultValue={profile.role}
                    name="role"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-7 text-sm font-medium text-asphalt-800">
                  <input
                    className="h-4 w-4 rounded border-asphalt-300"
                    defaultChecked={profile.is_active}
                    name="isActive"
                    type="checkbox"
                  />
                  Aktiv
                </label>

                <div className="flex flex-wrap items-center gap-2 md:col-span-3">
                  <span className="text-xs text-asphalt-500">
                    {stats.activeActivities} aktive Aktivitäten,{" "}
                    {stats.ignoredActivities} ignoriert, {stats.points} P aus
                    Aktivitäten, {formatSignedPoints(adjustmentPoints)}
                    Korrektur, {stats.points + adjustmentPoints} P gesamt
                  </span>
                  {isLastActiveAdmin ? (
                    <span className="text-xs font-medium text-amber-700">
                      Letzter aktiver Admin: Rolle und Aktivstatus bleiben
                      serverseitig geschützt.
                    </span>
                  ) : null}
                  <button
                    type="submit"
                    className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border border-asphalt-300 px-3 text-xs font-medium text-asphalt-800"
                  >
                    <Save aria-hidden className="h-4 w-4" />
                    Speichern
                  </button>
                </div>
              </form>

              <form
                action={`/api/admin/members/${profile.id}`}
                method="post"
                className="flex lg:min-w-44"
              >
                <input name="action" type="hidden" value="delete" />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-800"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Profil löschen
                </button>
              </form>

              <form
                action={`/api/admin/members/${profile.id}`}
                method="post"
                className="flex lg:min-w-56"
              >
                <input name="action" type="hidden" value="purge-strava" />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-amber-200 px-3 text-sm font-medium text-amber-800"
                >
                  <ShieldX aria-hidden className="h-4 w-4" />
                  Strava-Daten bereinigen
                </button>
              </form>

              <form
                action={`/api/admin/sync/user/${profile.id}`}
                method="post"
                className="flex flex-col gap-2 lg:min-w-72"
              >
                <select
                  className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                  name="seasonId"
                  defaultValue={
                    seasons.find((season) => season.is_active)?.id ?? "all"
                  }
                >
                  <option value="all">Alle Saisons</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                      {season.is_active ? " (aktiv)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-asphalt-300"
                  disabled={!connection || connection.revoked}
                >
                  <RefreshCcw aria-hidden className="h-4 w-4" />
                  User resync
                </button>
              </form>
            </div>

            <form
              action={`/api/admin/members/${profile.id}`}
              method="post"
              className="mt-4 grid gap-3 border-t border-asphalt-100 pt-4 sm:grid-cols-[1fr_0.7fr_1.4fr_auto] sm:items-end"
            >
              <input name="action" type="hidden" value="adjust-points" />
              <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
                Saison
                <select
                  className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                  name="seasonId"
                  defaultValue={
                    seasons.find((season) => season.is_active)?.id ??
                    seasons[0]?.id ??
                    ""
                  }
                  required
                >
                  {seasons.map((season) => {
                    const current = adjustments.find(
                      (adjustment) => adjustment.season_id === season.id,
                    );

                    return (
                      <option key={season.id} value={season.id}>
                        {season.name}:{" "}
                        {formatSignedPoints(current?.points ?? 0)}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
                Punkte +/−
                <input
                  className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                  max="10000"
                  min="-10000"
                  name="pointsDelta"
                  placeholder="z. B. 80 oder -20"
                  required
                  step="1"
                  type="number"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
                Begründung
                <input
                  className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                  maxLength={500}
                  name="reason"
                  placeholder="z. B. fehlende Aktivität"
                />
              </label>
              <button
                type="submit"
                className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800 disabled:cursor-not-allowed disabled:bg-asphalt-100"
                disabled={seasons.length === 0}
              >
                <Save aria-hidden className="h-4 w-4" />
                Korrigieren
              </button>
            </form>
            {connection ? (
              <dl className="mt-4 grid gap-2 border-t border-asphalt-100 pt-4 text-xs text-asphalt-500 md:grid-cols-3">
                <div>
                  <dt className="font-semibold uppercase">Athlete ID</dt>
                  <dd>{connection.strava_athlete_id}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase">Token Ablauf</dt>
                  <dd>
                    {connection.expires_at
                      ? formatDateTime(connection.expires_at)
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase">Scope</dt>
                  <dd>{connection.scope ?? "-"}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </details>

        <a
          className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
          href={`/admin/activities?userId=${profile.id}`}
        >
          <Users aria-hidden className="h-4 w-4" />
          Aktivitäten
        </a>
      </div>
    </article>
  );
}

function StravaBadge({ connection }: { connection: ConnectionRow | null }) {
  if (!connection) {
    return <StatusBadge tone="neutral">Strava fehlt</StatusBadge>;
  }

  return (
    <StatusBadge tone={connection.revoked ? "danger" : "success"}>
      {connection.revoked ? "Strava widerrufen" : "Strava verbunden"}
    </StatusBadge>
  );
}

async function loadMembersState(): Promise<MembersState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const [
      profilesResult,
      connectionsResult,
      activities,
      seasonsResult,
      adjustmentsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("display_name", { ascending: true }),
      supabase
        .from("strava_connections")
        .select("user_id, strava_athlete_id, expires_at, scope, revoked"),
      loadAllActivities(supabase),
      supabase
        .from("seasons")
        .select("*")
        .order("starts_on", { ascending: false }),
      supabase.from("member_point_adjustments").select("*"),
    ]);

    const firstError =
      profilesResult.error ??
      connectionsResult.error ??
      seasonsResult.error ??
      adjustmentsResult.error;

    if (firstError) {
      throw firstError;
    }

    const connections = new Map(
      ((connectionsResult.data ?? []) as ConnectionRow[]).map((connection) => [
        connection.user_id,
        connection,
      ]),
    );

    return {
      kind: "ready",
      adjustments: buildAdjustmentsByUser(
        (adjustmentsResult.data ?? []) as PointAdjustmentRow[],
      ),
      activityStats: buildActivityStats(activities),
      activeAdminCount: ((profilesResult.data ?? []) as ProfileRow[]).filter(
        (profile) => profile.role === "admin" && profile.is_active,
      ).length,
      connections,
      profiles: (profilesResult.data ?? []) as ProfileRow[],
      seasons: (seasonsResult.data ?? []) as SeasonRow[],
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Mitglieder konnten nicht geladen werden.",
    };
  }
}

async function loadAllActivities(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
): Promise<ActivityMiniRow[]> {
  const activities: ActivityMiniRow[] = [];

  for (let from = 0; ; from += ACTIVITY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("activities")
      .select("user_id, points, status, matched_rule_id")
      .order("id", { ascending: true })
      .range(from, from + ACTIVITY_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as ActivityMiniRow[];
    activities.push(...page);

    if (page.length < ACTIVITY_PAGE_SIZE) {
      return activities;
    }
  }
}

function buildActivityStats(activities: ActivityMiniRow[]) {
  return activities.reduce((statsByUser, activity) => {
    const current = statsByUser.get(activity.user_id) ?? { ...emptyStats };

    if (
      activity.status === "active" &&
      activity.points > 0 &&
      activity.matched_rule_id
    ) {
      current.activeActivities += 1;
      current.points += activity.points;
    }

    if (activity.status === "ignored") {
      current.ignoredActivities += 1;
    }

    statsByUser.set(activity.user_id, current);
    return statsByUser;
  }, new Map<string, MemberStats>());
}

const emptyStats: MemberStats = {
  activeActivities: 0,
  ignoredActivities: 0,
  points: 0,
};

function buildAdjustmentsByUser(adjustments: PointAdjustmentRow[]) {
  return adjustments.reduce((byUser, adjustment) => {
    const current = byUser.get(adjustment.user_id) ?? [];

    current.push(adjustment);
    byUser.set(adjustment.user_id, current);
    return byUser;
  }, new Map<string, PointAdjustmentRow[]>());
}

function formatSignedPoints(points: number) {
  return `${points > 0 ? "+" : ""}${points} P`;
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

import { Ban, Filter, RefreshCcw, RotateCcw, Route, Save } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminActivitiesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

type ActivitiesState =
  | {
      activities: ActivityRow[];
      filters: ActivityFilters;
      kind: "ready";
      profiles: ProfileRow[];
      seasons: SeasonRow[];
    }
  | { kind: "error"; message: string };

type ActivityFilters = {
  search: string;
  seasonId: string;
  source: string;
  status: string;
  userId: string;
};

export const dynamic = "force-dynamic";

export default async function AdminActivitiesPage({
  searchParams,
}: AdminActivitiesPageProps) {
  const params = searchParams ? await searchParams : {};
  const state = await loadActivitiesState(params);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Aktivitaetspruefung"
        description="Aktivitaeten filtern, manuelle Eintraege pruefen, neu bewerten oder aus der Wertung ausschliessen."
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
        <>
          <FilterPanel
            filters={state.filters}
            profiles={state.profiles}
            seasons={state.seasons}
          />
          <SeasonActions filters={state.filters} seasons={state.seasons} />
          <ActivityList
            activities={state.activities}
            profiles={
              new Map(state.profiles.map((profile) => [profile.id, profile]))
            }
            seasons={
              new Map(state.seasons.map((season) => [season.id, season]))
            }
          />
        </>
      )}
    </main>
  );
}

function FilterPanel({
  filters,
  profiles,
  seasons,
}: {
  filters: ActivityFilters;
  profiles: ProfileRow[];
  seasons: SeasonRow[];
}) {
  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex items-center gap-2">
        <Filter aria-hidden className="h-5 w-5 text-signal-blue" />
        <h2 className="text-base font-semibold text-asphalt-900">Filter</h2>
      </div>
      <form className="mt-4 grid gap-4 md:grid-cols-5" method="get">
        <SelectField label="Saison" name="seasonId" value={filters.seasonId}>
          <option value="all">Alle Saisons</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
              {season.is_active ? " (aktiv)" : ""}
            </option>
          ))}
        </SelectField>
        <SelectField label="Mitglied" name="userId" value={filters.userId}>
          <option value="all">Alle Mitglieder</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.display_name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Quelle" name="source" value={filters.source}>
          <option value="all">Alle</option>
          <option value="strava">Strava</option>
          <option value="manual">Manuell</option>
        </SelectField>
        <SelectField label="Status" name="status" value={filters.status}>
          <option value="all">Alle</option>
          <option value="active">active</option>
          <option value="ignored">ignored</option>
          <option value="deleted">deleted</option>
        </SelectField>
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
          Suche
          <input
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
            defaultValue={filters.search}
            name="search"
            placeholder="Name"
          />
        </label>
        <button
          type="submit"
          className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white md:col-span-5 md:w-fit"
        >
          <Filter aria-hidden className="h-4 w-4" />
          Anwenden
        </button>
      </form>
    </section>
  );
}

function SeasonActions({
  filters,
  seasons,
}: {
  filters: ActivityFilters;
  seasons: SeasonRow[];
}) {
  const selectedSeason = seasons.find(
    (season) => season.id === filters.seasonId,
  );

  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCcw aria-hidden className="h-5 w-5 text-signal-blue" />
            <h2 className="text-base font-semibold text-asphalt-900">
              Re-Scoring
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-asphalt-600">
            {selectedSeason
              ? `Aktive Filter-Saison: ${selectedSeason.name}`
              : "Waehle eine einzelne Saison, um alle aktiven Aktivitaeten neu zu bewerten."}
          </p>
        </div>
        <form
          action={
            selectedSeason
              ? `/api/admin/rescore/season/${selectedSeason.id}`
              : "/admin/activities"
          }
          method="post"
        >
          <button
            type="submit"
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-asphalt-300"
            disabled={!selectedSeason}
          >
            <RefreshCcw aria-hidden className="h-4 w-4" />
            Saison neu bewerten
          </button>
        </form>
      </div>
    </section>
  );
}

function ActivityList({
  activities,
  profiles,
  seasons,
}: {
  activities: ActivityRow[];
  profiles: Map<string, ProfileRow>;
  seasons: Map<string, SeasonRow>;
}) {
  if (activities.length === 0) {
    return (
      <section className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm leading-6 text-asphalt-600 shadow-line">
        Keine Aktivitaeten fuer die aktuellen Filter.
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      {activities.map((activity) => {
        const profile = profiles.get(activity.user_id);
        const season = seasons.get(activity.season_id);

        return (
          <article
            key={activity.id}
            className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Route aria-hidden className="h-5 w-5 text-signal-blue" />
                  <h2 className="text-base font-semibold text-asphalt-900">
                    {activity.activity_name}
                  </h2>
                  <StatusBadge tone={statusTone(activity.status)}>
                    {activity.status}
                  </StatusBadge>
                  <StatusBadge
                    tone={activity.source === "manual" ? "warning" : "info"}
                  >
                    {activity.source}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-6 text-asphalt-600">
                  {profile?.display_name ?? activity.user_id} -{" "}
                  {season?.name ?? activity.season_id} -{" "}
                  {formatDateTime(
                    activity.activity_started_local_at ??
                      activity.activity_started_at,
                  )}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-asphalt-500">
                  <span>{activity.points} Punkte</span>
                  <span>{activity.category ?? "keine Kategorie"}</span>
                  <span>{activity.sport_type ?? "Sporttyp offen"}</span>
                  {activity.distance_m !== null ? (
                    <span>{formatDistance(activity.distance_m)} km</span>
                  ) : null}
                  {activity.strava_url ? (
                    <a
                      className="focus-ring rounded-sm text-signal-blue"
                      href={activity.strava_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Strava
                    </a>
                  ) : null}
                </div>
                {activity.scoring_reason ? (
                  <p className="mt-2 text-xs leading-5 text-asphalt-500">
                    {activity.scoring_reason}
                  </p>
                ) : null}
                {activity.manual_comment ? (
                  <p className="mt-2 rounded-md bg-asphalt-50 p-2 text-xs leading-5 text-asphalt-700">
                    Kommentar: {activity.manual_comment}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 lg:min-w-48">
                <form
                  action={`/api/admin/rescore/activity/${activity.id}`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
                  >
                    <RotateCcw aria-hidden className="h-4 w-4" />
                    Neu bewerten
                  </button>
                </form>
                {activity.status === "active" ? (
                  <form
                    action={`/api/admin/activities/${activity.id}/status`}
                    method="post"
                  >
                    <input type="hidden" name="action" value="ignore" />
                    <button
                      type="submit"
                      className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-red-300 px-3 text-sm font-medium text-red-900"
                    >
                      <Ban aria-hidden className="h-4 w-4" />
                      Ausschliessen
                    </button>
                  </form>
                ) : null}
                {activity.status === "ignored" ? (
                  <form
                    action={`/api/admin/activities/${activity.id}/status`}
                    method="post"
                  >
                    <input type="hidden" name="action" value="reactivate" />
                    <button
                      type="submit"
                      className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
                    >
                      <Save aria-hidden className="h-4 w-4" />
                      Reaktivieren
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function SelectField({
  children,
  label,
  name,
  value,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <select
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={value}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

async function loadActivitiesState(
  params: Record<string, string | string[] | undefined>,
): Promise<ActivitiesState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const [profilesResult, seasonsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("display_name", { ascending: true }),
      supabase
        .from("seasons")
        .select("*")
        .order("starts_on", { ascending: false }),
    ]);

    if (profilesResult.error || seasonsResult.error) {
      throw profilesResult.error ?? seasonsResult.error;
    }

    const seasons = (seasonsResult.data ?? []) as SeasonRow[];
    const filters = buildFilters(params, seasons);
    let query = supabase
      .from("activities")
      .select("*")
      .order("activity_started_at", { ascending: false })
      .limit(150);

    if (filters.seasonId !== "all") {
      query = query.eq("season_id", filters.seasonId);
    }

    if (filters.userId !== "all") {
      query = query.eq("user_id", filters.userId);
    }

    if (filters.source === "strava" || filters.source === "manual") {
      query = query.eq("source", filters.source);
    }

    if (
      filters.status === "active" ||
      filters.status === "ignored" ||
      filters.status === "deleted"
    ) {
      query = query.eq("status", filters.status);
    }

    if (filters.search) {
      query = query.ilike("activity_name", `%${filters.search}%`);
    }

    const activitiesResult = await query;

    if (activitiesResult.error) {
      throw activitiesResult.error;
    }

    return {
      activities: (activitiesResult.data ?? []) as ActivityRow[],
      filters,
      kind: "ready",
      profiles: (profilesResult.data ?? []) as ProfileRow[],
      seasons,
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Aktivitaeten konnten nicht geladen werden.",
    };
  }
}

function buildFilters(
  params: Record<string, string | string[] | undefined>,
  seasons: SeasonRow[],
): ActivityFilters {
  const activeSeason = seasons.find((season) => season.is_active);

  return {
    search: getSingleParam(params.search) ?? "",
    seasonId: getSingleParam(params.seasonId) ?? activeSeason?.id ?? "all",
    source: getSingleParam(params.source) ?? "all",
    status: getSingleParam(params.status) ?? "all",
    userId: getSingleParam(params.userId) ?? "all",
  };
}

function statusTone(status: ActivityRow["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "ignored":
      return "warning";
    case "deleted":
      return "danger";
  }
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

function formatDistance(distanceM: number) {
  return new Intl.NumberFormat("de-CH", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(distanceM / 1000);
}

import {
  Ban,
  CheckCircle2,
  Filter,
  PlusCircle,
  RefreshCcw,
  RotateCcw,
  Route,
  Save,
} from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { toLocalInputValue } from "@/lib/manual-entry/time";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminActivitiesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ScoringRuleRow = Database["public"]["Tables"]["scoring_rules"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

type ActivitiesState =
  | {
      activities: ActivityRow[];
      filters: ActivityFilters;
      kind: "ready";
      profiles: ProfileRow[];
      rules: ScoringRuleRow[];
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
          <AdminManualActivityForm
            filters={state.filters}
            profiles={state.profiles}
            rules={state.rules}
            seasons={state.seasons}
          />
          <SeasonActions filters={state.filters} seasons={state.seasons} />
          <ActivityList
            activities={state.activities}
            profiles={
              new Map(state.profiles.map((profile) => [profile.id, profile]))
            }
            rules={state.rules}
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

function AdminManualActivityForm({
  filters,
  profiles,
  rules,
  seasons,
}: {
  filters: ActivityFilters;
  profiles: ProfileRow[];
  rules: ScoringRuleRow[];
  seasons: SeasonRow[];
}) {
  const activeSeason = seasons.find((season) => season.is_active);
  const defaultUserId = filters.userId !== "all" ? filters.userId : "";
  const defaultSeasonId =
    filters.seasonId !== "all" ? filters.seasonId : (activeSeason?.id ?? "");
  const defaultRule =
    rules.find(
      (rule) => !rule.season_id || rule.season_id === defaultSeasonId,
    ) ?? rules[0];

  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex items-center gap-2">
        <PlusCircle aria-hidden className="h-5 w-5 text-signal-blue" />
        <h2 className="text-base font-semibold text-asphalt-900">
          Manuelle Admin-Aktivitaet
        </h2>
      </div>
      <form
        action="/api/admin/activities/manual"
        className="mt-4 grid gap-4 lg:grid-cols-6"
        method="post"
      >
        <SelectField label="Mitglied" name="userId" value={defaultUserId}>
          <option value="">Mitglied waehlen</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.display_name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Saison" name="seasonId" value={defaultSeasonId}>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
              {season.is_active ? " (aktiv)" : ""}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Scoring-Regel"
          name="ruleId"
          value={defaultRule?.id ?? ""}
        >
          <option value="">Regel waehlen</option>
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {formatRuleOption(rule)}
            </option>
          ))}
        </SelectField>
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
          Datum und Zeit
          <input
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
            defaultValue={toLocalInputValue(new Date())}
            name="activityStartedLocal"
            required
            type="datetime-local"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
          Aktivitaetsname
          <input
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
            maxLength={120}
            name="activityName"
            placeholder="optional"
          />
        </label>
        <SelectField label="Sportart" name="sportType" value="Ride">
          <option value="Ride">Ride</option>
          <option value="VirtualRide">VirtualRide</option>
          <option value="GravelRide">GravelRide</option>
          <option value="MountainBikeRide">MountainBikeRide</option>
        </SelectField>
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
          Distanz km
          <input
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
            max="1000"
            min="0"
            name="distanceKm"
            placeholder="optional"
            step="0.1"
            type="number"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800 lg:col-span-4">
          Kommentar
          <input
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
            maxLength={500}
            name="comment"
            placeholder="optional"
          />
        </label>
        <button
          type="submit"
          className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-asphalt-300 lg:col-span-1 lg:self-end"
          disabled={
            profiles.length === 0 || seasons.length === 0 || rules.length === 0
          }
        >
          <PlusCircle aria-hidden className="h-4 w-4" />
          Hinzufuegen
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
  rules,
  seasons,
}: {
  activities: ActivityRow[];
  profiles: Map<string, ProfileRow>;
  rules: ScoringRuleRow[];
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
        const scoringRules = getRulesForSeason(rules, activity.season_id);
        const canAddToScoring =
          activity.source === "strava" &&
          activity.status === "active" &&
          (!activity.matched_rule_id || activity.points <= 0);

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
                  {activity.scoring_override_rule_id ? (
                    <StatusBadge tone="warning">Override</StatusBadge>
                  ) : null}
                  {canAddToScoring ? (
                    <StatusBadge tone="neutral">nicht gewertet</StatusBadge>
                  ) : null}
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
                {canAddToScoring ? (
                  <form
                    action={`/api/admin/activities/${activity.id}/status`}
                    method="post"
                    className="grid gap-2"
                  >
                    <input type="hidden" name="action" value="score" />
                    <select
                      className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                      name="ruleId"
                      required
                    >
                      <option value="">Regel waehlen</option>
                      {scoringRules.map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {formatRuleOption(rule)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-asphalt-300"
                      disabled={scoringRules.length === 0}
                    >
                      <CheckCircle2 aria-hidden className="h-4 w-4" />
                      Zur Wertung
                    </button>
                  </form>
                ) : null}
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
    const [profilesResult, seasonsResult, rulesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("display_name", { ascending: true }),
      supabase
        .from("seasons")
        .select("*")
        .order("starts_on", { ascending: false }),
      supabase
        .from("scoring_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("name", { ascending: true }),
    ]);

    if (profilesResult.error || seasonsResult.error || rulesResult.error) {
      throw profilesResult.error ?? seasonsResult.error ?? rulesResult.error;
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
      rules: (rulesResult.data ?? []) as ScoringRuleRow[],
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

function getRulesForSeason(rules: ScoringRuleRow[], seasonId: string) {
  return rules.filter((rule) => !rule.season_id || rule.season_id === seasonId);
}

function formatRuleOption(rule: ScoringRuleRow) {
  const scope = rule.season_id ? "saisongebunden" : "global";

  return `${rule.name} - ${rule.points} P (${scope})`;
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

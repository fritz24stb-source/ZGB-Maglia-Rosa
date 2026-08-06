import Link from "next/link";
import { ChevronDown, Flag, Pencil, Trash2 } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import {
  SprintDayForm,
  type SprintDayFormValue,
} from "@/components/sprint-day-form";
import { requireCiclaminoManagerPage } from "@/lib/auth/page-guard";
import {
  CICLAMINO_LOCATIONS,
  defaultSeasonWednesday,
  todayInZurich,
  type CiclaminoLocation,
} from "@/lib/classifications/ciclamino";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name"
>;
type Season = Pick<
  Database["public"]["Tables"]["seasons"]["Row"],
  "ends_on" | "id" | "is_active" | "name" | "starts_on"
>;
type Sprint = Database["public"]["Tables"]["ciclamino_sprints"]["Row"] & {
  placements: Database["public"]["Tables"]["ciclamino_placements"]["Row"][];
};
type SprintDay = {
  key: string;
  seasonId: string;
  seasonName: string;
  sprintDate: string;
  sprints: Sprint[];
};

export const dynamic = "force-dynamic";

export default async function SprintsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const blocked = await requireCiclaminoManagerPage("/sprints");
  if (blocked) return blocked;

  const params = searchParams ? await searchParams : {};
  const { profiles, seasons, sprintDays } = await loadSprintData();
  const activeSeason = seasons.find((season) => season.is_active) ?? seasons[0];
  const editKey = single(params.edit);
  const editingDay = sprintDays.find((day) => day.key === editKey);
  const today = todayInZurich();
  const initialValue = editingDay
    ? toFormValue(editingDay)
    : emptyFormValue(activeSeason, today);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Sprintpflege"
        description="Alle drei Ortsschild-Sprints eines Mittwochs gemeinsam mit den Plätzen 1 bis 5 erfassen."
      />
      <AdminFlash error={single(params.adminError)} status={single(params.adminStatus)} />

      {activeSeason && initialValue ? (
        <section id="sprint-form" className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flag aria-hidden className="h-5 w-5 text-fuchsia-700" />
              <h2 className="text-base font-semibold text-asphalt-900">
                {editingDay ? `Sprinttag vom ${formatDate(editingDay.sprintDate)} bearbeiten` : "Neuer Sprinttag"}
              </h2>
            </div>
            {editingDay ? (
              <Link href="/sprints#sprint-form" className="focus-ring rounded-md border border-asphalt-300 px-3 py-2 text-sm font-medium text-asphalt-700">
                Bearbeitung abbrechen
              </Link>
            ) : null}
          </div>
          <SprintDayForm
            key={`${initialValue.seasonId}:${initialValue.sprintDate}:${Boolean(editingDay)}`}
            initialValue={initialValue}
            isEditing={Boolean(editingDay)}
            profiles={profiles.map((profile) => ({ id: profile.id, displayName: profile.display_name }))}
            seasons={seasons.map((season) => ({
              endsOn: season.ends_on,
              id: season.id,
              isActive: season.is_active,
              name: season.name,
              startsOn: season.starts_on,
            }))}
            today={today}
          />
        </section>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Für die Sprintpflege wird eine Saison mit mindestens einem Mittwoch benötigt.
        </p>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-asphalt-900">Angelegte Sprinttage</h2>
        {sprintDays.length === 0 ? (
          <p className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">
            Noch keine Ciclamino-Sprints erfasst.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line">
            <div className="hidden grid-cols-[10rem_minmax(0,1fr)_10rem_2.5rem] gap-3 bg-asphalt-50 px-4 py-3 text-xs font-semibold uppercase text-asphalt-600 md:grid">
              <span>Datum</span><span>Saison</span><span>Ortsschilder</span><span aria-hidden />
            </div>
            <div className="divide-y divide-asphalt-100">
              {sprintDays.map((day) => (
                <details key={day.key} className="group">
                  <summary className="focus-ring grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden md:grid-cols-[10rem_minmax(0,1fr)_10rem_2.5rem]">
                    <span className="font-semibold text-asphalt-900">{formatDate(day.sprintDate)}</span>
                    <span className="text-asphalt-600">{day.seasonName}</span>
                    <span className="hidden text-asphalt-600 md:block">{day.sprints.length} von 3</span>
                    <ChevronDown aria-hidden className="h-5 w-5 justify-self-end text-asphalt-500 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-asphalt-100 bg-asphalt-50/50 p-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      {CICLAMINO_LOCATIONS.map((location) => (
                        <LocationPlacements key={location} location={location} sprint={day.sprints.find((sprint) => sprint.name === location)} profiles={profiles} />
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/sprints?edit=${encodeURIComponent(day.key)}#sprint-form`} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white">
                        <Pencil aria-hidden className="h-4 w-4" /> Bearbeiten
                      </Link>
                      <form action="/api/ciclamino/sprints" method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="seasonId" value={day.seasonId} />
                        <input type="hidden" name="sprintDate" value={day.sprintDate} />
                        <button className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-800" type="submit">
                          <Trash2 aria-hidden className="h-4 w-4" /> Sprinttag löschen
                        </button>
                      </form>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function LocationPlacements({ location, sprint, profiles }: { location: CiclaminoLocation; sprint?: Sprint; profiles: Profile[] }) {
  const names = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  return (
    <section className="rounded-lg border border-fuchsia-100 bg-white p-4">
      <h3 className="font-semibold text-fuchsia-950">{location}</h3>
      {sprint ? (
        <ol className="mt-3 grid gap-2 text-sm">
          {[...sprint.placements].sort((left, right) => left.place - right.place).map((placement) => (
            <li key={placement.place} className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] gap-2">
              <span className="font-semibold">{placement.place}.</span>
              <span>{names.get(placement.user_id) ?? "Unbekannt"}</span>
              <span className="text-right font-semibold text-fuchsia-800">{placement.points} P</span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-3 text-sm text-asphalt-500">Nicht erfasst</p>}
    </section>
  );
}

async function loadSprintData() {
  const supabase = createSupabaseServiceRoleClient();
  const [profilesResult, seasonsResult, sprintsResult, placementsResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("is_active", true).order("display_name"),
    supabase.from("seasons").select("id, name, is_active, starts_on, ends_on").order("starts_on", { ascending: false }),
    supabase.from("ciclamino_sprints").select("*").order("sprint_date", { ascending: false }),
    supabase.from("ciclamino_placements").select("*").order("place"),
  ]);
  const error = profilesResult.error ?? seasonsResult.error ?? sprintsResult.error ?? placementsResult.error;
  if (error) throw error;
  const profiles = (profilesResult.data ?? []) as Profile[];
  const seasons = (seasonsResult.data ?? []) as Season[];
  const seasonNames = new Map(seasons.map((season) => [season.id, season.name]));
  const placements = placementsResult.data ?? [];
  const sprints = (sprintsResult.data ?? []).map((sprint) => ({
    ...sprint,
    placements: placements.filter((placement) => placement.sprint_id === sprint.id),
  })) as Sprint[];
  const days = new Map<string, SprintDay>();
  for (const sprint of sprints) {
    const key = dayKey(sprint.season_id, sprint.sprint_date);
    const day = days.get(key) ?? {
      key,
      seasonId: sprint.season_id,
      seasonName: seasonNames.get(sprint.season_id) ?? "Saison",
      sprintDate: sprint.sprint_date,
      sprints: [],
    };
    day.sprints.push(sprint);
    days.set(key, day);
  }
  return { profiles, seasons, sprintDays: [...days.values()] };
}

function toFormValue(day: SprintDay): SprintDayFormValue {
  return {
    seasonId: day.seasonId,
    sprintDate: day.sprintDate,
    locations: CICLAMINO_LOCATIONS.map((name) => {
      const sprint = day.sprints.find((candidate) => candidate.name === name);
      return {
        name,
        userIds: sprint ? [...sprint.placements].sort((left, right) => left.place - right.place).map((placement) => placement.user_id) : [],
      };
    }),
  };
}

function emptyFormValue(season: Season | undefined, today: string): SprintDayFormValue | null {
  if (!season) return null;
  const sprintDate = defaultSeasonWednesday({ startsOn: season.starts_on, endsOn: season.ends_on }, today);
  if (!sprintDate) return null;
  return {
    seasonId: season.id,
    sprintDate,
    locations: CICLAMINO_LOCATIONS.map((name) => ({ name, userIds: [] })),
  };
}

function dayKey(seasonId: string, sprintDate: string) { return `${seasonId}:${sprintDate}`; }
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }

import Link from "next/link";
import { Flag } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { CiclaminoSprintDays } from "@/components/ciclamino-sprint-days";
import { PageHeader } from "@/components/page-header";
import { SprintDayForm, type SprintDayFormValue } from "@/components/sprint-day-form";
import { requireCiclaminoManagerPage } from "@/lib/auth/page-guard";
import { CICLAMINO_LOCATIONS, defaultSeasonWednesday, todayInZurich } from "@/lib/classifications/ciclamino";
import type { CiclaminoSprintDay } from "@/lib/classifications/types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "display_name">;
type Season = Pick<Database["public"]["Tables"]["seasons"]["Row"], "ends_on" | "id" | "is_active" | "name" | "starts_on">;
type SprintRow = Database["public"]["Tables"]["ciclamino_sprints"]["Row"];

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
  const initialValue = editingDay ? toFormValue(editingDay) : emptyFormValue(activeSeason, today);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Sprintpflege"
        description="Alle drei Ortsschild-Sprints eines Mittwochs gemeinsam mit den Plätzen 1 bis 5 und dem Most Combative Rider erfassen."
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

      <CiclaminoSprintDays editable sprintDays={sprintDays} />
    </main>
  );
}

async function loadSprintData() {
  const supabase = createSupabaseServiceRoleClient();
  const [profilesResult, seasonsResult, sprintsResult, placementsResult, awardsResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("is_active", true).order("display_name"),
    supabase.from("seasons").select("id, name, is_active, starts_on, ends_on").order("starts_on", { ascending: false }),
    supabase.from("ciclamino_sprints").select("*").order("sprint_date", { ascending: false }),
    supabase.from("ciclamino_placements").select("*").order("place"),
    supabase.from("ciclamino_combative_awards").select("*"),
  ]);
  const error = profilesResult.error ?? seasonsResult.error ?? sprintsResult.error ?? placementsResult.error ?? awardsResult.error;
  if (error) throw error;

  const profiles = (profilesResult.data ?? []) as Profile[];
  const seasons = (seasonsResult.data ?? []) as Season[];
  const seasonNames = new Map(seasons.map((season) => [season.id, season.name]));
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  const placements = placementsResult.data ?? [];
  const awards = new Map((awardsResult.data ?? []).map((award) => [dayKey(award.season_id, award.sprint_date), award]));
  const sprints = (sprintsResult.data ?? []) as SprintRow[];
  const days = new Map<string, CiclaminoSprintDay>();

  for (const sprint of sprints) {
    const key = dayKey(sprint.season_id, sprint.sprint_date);
    const award = awards.get(key);
    const day = days.get(key) ?? {
      combativeRider: award ? {
        displayName: profileNames.get(award.user_id) ?? "Unbekannt",
        points: award.points,
        userId: award.user_id,
      } : null,
      key,
      seasonId: sprint.season_id,
      seasonName: seasonNames.get(sprint.season_id) ?? "Saison",
      sprintDate: sprint.sprint_date,
      sprints: [],
    };
    day.sprints.push({
      id: sprint.id,
      name: sprint.name,
      placements: placements
        .filter((placement) => placement.sprint_id === sprint.id)
        .sort((left, right) => left.place - right.place)
        .map((placement) => ({
          displayName: profileNames.get(placement.user_id) ?? "Unbekannt",
          place: placement.place,
          points: placement.points,
          userId: placement.user_id,
        })),
    });
    days.set(key, day);
  }

  return { profiles, seasons, sprintDays: [...days.values()] };
}

function toFormValue(day: CiclaminoSprintDay): SprintDayFormValue {
  return {
    combativeUserId: day.combativeRider?.userId ?? "",
    seasonId: day.seasonId,
    sprintDate: day.sprintDate,
    locations: CICLAMINO_LOCATIONS.map((name) => {
      const sprint = day.sprints.find((candidate) => candidate.name === name);
      return { name, userIds: sprint?.placements.map((placement) => placement.userId) ?? [] };
    }),
  };
}

function emptyFormValue(season: Season | undefined, today: string): SprintDayFormValue | null {
  if (!season) return null;
  const sprintDate = defaultSeasonWednesday({ startsOn: season.starts_on, endsOn: season.ends_on }, today);
  if (!sprintDate) return null;
  return {
    combativeUserId: "",
    seasonId: season.id,
    sprintDate,
    locations: CICLAMINO_LOCATIONS.map((name) => ({ name, userIds: [] })),
  };
}

function dayKey(seasonId: string, sprintDate: string) { return `${seasonId}:${sprintDate}`; }
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }

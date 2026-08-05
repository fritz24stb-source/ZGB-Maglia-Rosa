import { Flag, Save, Trash2 } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { requireCiclaminoManagerPage } from "@/lib/auth/page-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name"
>;
type Season = Pick<
  Database["public"]["Tables"]["seasons"]["Row"],
  "id" | "name" | "is_active"
>;
type Sprint = Database["public"]["Tables"]["ciclamino_sprints"]["Row"] & {
  placements: Database["public"]["Tables"]["ciclamino_placements"]["Row"][];
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
  const { profiles, seasons, sprints } = await loadSprintData();
  const activeSeasonId = seasons.find((season) => season.is_active)?.id ?? seasons[0]?.id ?? "";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Sprintpflege"
        description="Ciclamino-Sprints mit den Plätzen 1 bis 3 erfassen und korrigieren."
      />
      <AdminFlash
        error={single(params.adminError)}
        status={single(params.adminStatus)}
      />

      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="mb-4 flex items-center gap-2">
          <Flag aria-hidden className="h-5 w-5 text-fuchsia-700" />
          <h2 className="text-base font-semibold text-asphalt-900">Neuer Sprint</h2>
        </div>
        <SprintForm profiles={profiles} seasons={seasons} defaultSeasonId={activeSeasonId} />
      </section>

      <section className="grid gap-4">
        {sprints.length === 0 ? (
          <p className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">
            Noch keine Ciclamino-Sprints erfasst.
          </p>
        ) : (
          sprints.map((sprint) => (
            <article key={sprint.id} className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
              <SprintForm
                profiles={profiles}
                seasons={seasons}
                defaultSeasonId={sprint.season_id}
                sprint={sprint}
              />
              <form action="/api/ciclamino/sprints" method="post" className="mt-3">
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="sprintId" value={sprint.id} />
                <button className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-800" type="submit">
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Löschen
                </button>
              </form>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function SprintForm({ profiles, seasons, defaultSeasonId, sprint }: {
  profiles: Profile[];
  seasons: Season[];
  defaultSeasonId: string;
  sprint?: Sprint;
}) {
  const placements = new Map(sprint?.placements.map((placement) => [placement.place, placement.user_id]));
  return (
    <form action="/api/ciclamino/sprints" method="post" className="grid gap-4">
      {sprint ? <input type="hidden" name="sprintId" value={sprint.id} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Saison">
          <select name="seasonId" defaultValue={defaultSeasonId} required className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm">
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.is_active ? " (aktiv)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Datum">
          <input name="sprintDate" type="date" defaultValue={sprint?.sprint_date} required className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" />
        </Field>
        <Field label="Bezeichnung">
          <input name="name" defaultValue={sprint?.name} maxLength={120} required className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" placeholder="z. B. Ortsschild Baar" />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((place) => (
          <Field key={place} label={`${place}. Platz (${place === 1 ? 5 : place === 2 ? 3 : 1} P)`}>
            <select name={`place${place}UserId`} defaultValue={placements.get(place) ?? ""} required className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm">
              <option value="" disabled>Mitglied wählen</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}
            </select>
          </Field>
        ))}
      </div>
      <button type="submit" className="focus-ring inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white">
        <Save aria-hidden className="h-4 w-4" />
        {sprint ? "Änderungen speichern" : "Sprint anlegen"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">{label}{children}</label>;
}

async function loadSprintData() {
  const supabase = createSupabaseServiceRoleClient();
  const [profilesResult, seasonsResult, sprintsResult, placementsResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("is_active", true).order("display_name"),
    supabase.from("seasons").select("id, name, is_active").order("starts_on", { ascending: false }),
    supabase.from("ciclamino_sprints").select("*").order("sprint_date", { ascending: false }),
    supabase.from("ciclamino_placements").select("*").order("place"),
  ]);
  const error = profilesResult.error ?? seasonsResult.error ?? sprintsResult.error ?? placementsResult.error;
  if (error) throw error;
  const placements = placementsResult.data ?? [];
  return {
    profiles: (profilesResult.data ?? []) as Profile[],
    seasons: (seasonsResult.data ?? []) as Season[],
    sprints: (sprintsResult.data ?? []).map((sprint) => ({
      ...sprint,
      placements: placements.filter((placement) => placement.sprint_id === sprint.id),
    })) as Sprint[],
  };
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

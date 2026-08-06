import Link from "next/link";
import { CheckCircle2, Clock3, Vote } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireActiveAppPage } from "@/lib/auth/page-guard";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";
import { defaultSeasonWednesday, todayInZurich } from "@/lib/classifications/ciclamino";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CombativeVotePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const blocked = await requireActiveAppPage("/ciclamino/vote");
  if (blocked) return blocked;
  const access = await loadCurrentAppAccessState();
  if (access.kind !== "active") return null;
  const params = searchParams ? await searchParams : {};
  const supabase = createSupabaseServiceRoleClient();
  const [seasonResult, profilesResult] = await Promise.all([
    supabase.from("seasons").select("id, name, starts_on, ends_on, is_active").eq("is_active", true).maybeSingle(),
    supabase.from("profiles").select("id, display_name").eq("is_active", true).order("display_name"),
  ]);
  if (seasonResult.error ?? profilesResult.error) throw seasonResult.error ?? profilesResult.error;
  const season = seasonResult.data;
  if (!season) return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6"><p>Keine aktive Saison vorhanden.</p></main>;

  const { data: windows, error: windowsError } = await supabase.from("ciclamino_combative_voting_windows").select("*").eq("season_id", season.id).order("sprint_date", { ascending: false });
  if (windowsError) throw windowsError;
  const requestedDate = single(params.sprintDate);
  const currentWednesday = defaultSeasonWednesday({ startsOn: season.starts_on, endsOn: season.ends_on }, todayInZurich());
  const selectedWindow = (windows ?? []).find((window) => window.sprint_date === requestedDate)
    ?? (windows ?? []).find((window) => window.sprint_date === currentWednesday)
    ?? windows?.[0]
    ?? null;
  const { data: currentVote, error: voteError } = selectedWindow
    ? await supabase.from("ciclamino_combative_votes").select("candidate_user_id").eq("season_id", season.id).eq("sprint_date", selectedWindow.sprint_date).eq("voter_user_id", access.userId).maybeSingle()
    : { data: null, error: null };
  if (voteError) throw voteError;
  const now = new Date();
  const status = !selectedWindow ? "missing" : now < new Date(selectedWindow.opens_at) ? "scheduled" : now < new Date(selectedWindow.closes_at) ? "open" : "closed";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Most Combative Rider" description="Stimme für den kämpferischsten Fahrer des aktuellen Mittwoch-Sprinttags ab." />
      <Link href={`/leaderboard?classification=ciclamino&seasonId=${season.id}`} className="focus-ring w-fit rounded-sm text-sm font-medium text-fuchsia-800">← Zur Ciclamino-Wertung</Link>
      {single(params.voteStatus) ? <div className="flex gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900"><CheckCircle2 aria-hidden className="h-5 w-5" />{single(params.voteStatus)}</div> : null}
      {single(params.voteError) ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{single(params.voteError)}</div> : null}

      <section className="rounded-lg border border-fuchsia-200 bg-white p-5 shadow-line">
        <div className="flex items-center gap-3"><Vote aria-hidden className="h-6 w-6 text-fuchsia-700" /><h2 className="text-lg font-semibold text-asphalt-900">Abstimmung</h2></div>
        {(windows ?? []).length > 0 ? (
          <form action="/ciclamino/vote" className="mt-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">Mittwoch
              <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" defaultValue={selectedWindow?.sprint_date} name="sprintDate">
                {(windows ?? []).map((window) => <option key={window.sprint_date} value={window.sprint_date}>{formatDate(window.sprint_date)}</option>)}
              </select>
            </label>
            <button className="focus-ring mt-3 min-h-10 rounded-md border border-asphalt-300 px-4 text-sm font-medium" type="submit">Mittwoch anzeigen</button>
          </form>
        ) : null}

        {selectedWindow ? (
          <>
            <div className="mt-5 flex items-start gap-2 rounded-md bg-asphalt-50 p-3 text-sm text-asphalt-700">
              <Clock3 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{formatDateTime(selectedWindow.opens_at)} bis {formatDateTime(selectedWindow.closes_at)} · {status === "open" ? "Abstimmung offen" : status === "scheduled" ? "Noch nicht geöffnet" : "Abstimmung geschlossen"}</p>
            </div>
            {status === "open" ? (
              <form action="/api/ciclamino/vote" method="post" className="mt-5 grid gap-4">
                <input type="hidden" name="seasonId" value={season.id} /><input type="hidden" name="sprintDate" value={selectedWindow.sprint_date} />
                <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">Fahrer
                  <select className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3" defaultValue={currentVote?.candidate_user_id ?? ""} name="candidateUserId" required>
                    <option value="" disabled>Fahrer wählen</option>
                    {(profilesResult.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}
                  </select>
                </label>
                <button className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuchsia-700 px-4 font-semibold text-white" type="submit"><Vote aria-hidden className="h-4 w-4" />{currentVote ? "Stimme ändern" : "Stimme abgeben"}</button>
              </form>
            ) : <p className="mt-5 text-sm text-asphalt-600">Für diesen Sprinttag kann aktuell keine Stimme abgegeben werden.</p>}
          </>
        ) : <p className="mt-5 text-sm text-asphalt-600">Für den aktuellen Mittwoch wurde noch kein Abstimmungszeitraum angelegt.</p>}
      </section>
    </main>
  );
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value)); }

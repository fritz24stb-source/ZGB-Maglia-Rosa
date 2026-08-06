import Link from "next/link";
import { AlertTriangle, ChevronDown, Flag, Mountain, Trophy, Vote } from "lucide-react";
import { CiclaminoSprintDays } from "@/components/ciclamino-sprint-days";
import type {
  AzzurraLeaderboardRow,
  CiclaminoLeaderboardRow,
  ClassificationKind,
  ClassificationLeaderboardResponse,
} from "@/lib/classifications/types";
import { cn } from "@/lib/ui";

export function ClassificationTabs({ active, enabled, seasonId }: { active: ClassificationKind; enabled: boolean; seasonId?: string | null }) {
  const tabs: { key: ClassificationKind; label: string; color: string }[] = [
    { key: "rosa", label: "Maglia Rosa", color: "border-pink-500 text-pink-800" },
    ...(enabled ? [
      { key: "ciclamino" as const, label: "Maglia Ciclamino", color: "border-fuchsia-600 text-fuchsia-800" },
      { key: "azzurra" as const, label: "Maglia Azzurra", color: "border-sky-600 text-sky-800" },
    ] : []),
  ];
  return (
    <nav aria-label="Trikotwertung" className="grid gap-2 sm:grid-cols-3">
      {tabs.map((tab) => {
        const params = new URLSearchParams({ classification: tab.key });
        if (seasonId) params.set("seasonId", seasonId);
        return <Link key={tab.key} href={`/leaderboard?${params}`} aria-current={active === tab.key ? "page" : undefined} className={cn("focus-ring rounded-lg border bg-white px-4 py-3 text-center text-sm font-semibold shadow-line", active === tab.key ? tab.color : "border-asphalt-200 text-asphalt-600")}>{tab.label}</Link>;
      })}
    </nav>
  );
}

export function ClassificationLeaderboard({ active, data }: { active: "ciclamino" | "azzurra"; data: ClassificationLeaderboardResponse }) {
  const rows = active === "ciclamino" ? data.ciclamino : data.azzurra;
  const completedCiclaminoSprintDays = data.ciclaminoSprintDays.filter(
    (day) => day.votingWindow?.status === "closed",
  );
  return (
    <section className="flex flex-col gap-6">
      <form action="/leaderboard" className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
        <input type="hidden" name="classification" value={active} />
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-asphalt-800">
          Saison
          <select name="seasonId" defaultValue={data.selectedSeasonId ?? ""} className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm">
            {data.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.isActive ? " (aktiv)" : ""}</option>)}
          </select>
        </label>
        <button className="focus-ring mt-3 min-h-10 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white" type="submit">Anzeigen</button>
      </form>
      {active === "ciclamino" ? (
        <Link href="/ciclamino/vote" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fuchsia-700 px-4 text-sm font-semibold text-white shadow-line sm:w-fit">
          <Vote aria-hidden className="h-4 w-4" /> Zur Abstimmung Maglia Ciclamino
        </Link>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">Für diese Saison gibt es noch keine Teilnehmer in der gewählten Wertung.</p>
      ) : active === "ciclamino" ? <CiclaminoTable rows={data.ciclamino} /> : <AzzurraTable rows={data.azzurra} />}
      {active === "ciclamino" ? (
        <CiclaminoSprintDays sprintDays={completedCiclaminoSprintDays} title="Vergangene Sprints" />
      ) : null}
    </section>
  );
}

function CiclaminoTable({ rows }: { rows: CiclaminoLeaderboardRow[] }) {
  return (
    <>
      <div className="overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line md:hidden">
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_2.5rem] gap-2 border-b border-asphalt-100 bg-asphalt-50 px-3 py-2 text-xs font-semibold uppercase text-asphalt-500">
          <span>Platz</span><span>Fahrer</span><span className="text-right">Punkte</span><span className="sr-only">Details</span>
        </div>
        {rows.map((row) => (
          <details key={row.userId} className="group border-b border-asphalt-100 last:border-b-0">
            <summary className="focus-ring grid min-h-14 cursor-pointer list-none grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_2.5rem] items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
              <RankMarker place={row.place} tone="ciclamino" />
              <span className="min-w-0 truncate font-medium text-asphalt-900">{row.displayName}</span>
              <span className="text-right font-semibold text-asphalt-900">{number(row.totalPoints)}</span>
              <span className="flex justify-end text-asphalt-500"><ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
            </summary>
            <div className="border-t border-asphalt-100 px-3 py-3">
              <p className="mb-3 text-xs text-asphalt-500">{row.seasonName}</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Detail label="1. Plätze" value={row.wins} /><Detail label="2. Plätze" value={row.secondPlaces} />
                <Detail label="3. Plätze" value={row.thirdPlaces} /><Detail label="4. Plätze" value={row.fourthPlaces} />
                <Detail label="5. Plätze" value={row.fifthPlaces} /><Detail label="Platzierungen" value={row.sprintCount} />
                <Detail label="Most Combative" value={`${row.combativeAwards} × 5 P`} />
              </dl>
            </div>
          </details>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-fuchsia-200 bg-white shadow-line md:block">
        <table className="min-w-[1040px] w-full text-left text-sm">
          <thead className="bg-fuchsia-50 text-xs uppercase text-fuchsia-900"><tr><th className="px-4 py-3">Platz</th><th className="px-4 py-3">Fahrer</th><th className="px-4 py-3 text-right">Punkte</th><th className="px-4 py-3 text-right">1.</th><th className="px-4 py-3 text-right">2.</th><th className="px-4 py-3 text-right">3.</th><th className="px-4 py-3 text-right">4.</th><th className="px-4 py-3 text-right">5.</th><th className="px-4 py-3 text-right">Most Combative</th><th className="px-4 py-3 text-right">Platzierungen</th></tr></thead>
          <tbody className="divide-y divide-asphalt-100">{rows.map((row) => <tr key={row.userId}><RankCell place={row.place} tone="ciclamino" /><td className="px-4 py-4 font-medium">{row.displayName}</td><td className="px-4 py-4 text-right font-semibold">{row.totalPoints}</td><td className="px-4 py-4 text-right">{row.wins}</td><td className="px-4 py-4 text-right">{row.secondPlaces}</td><td className="px-4 py-4 text-right">{row.thirdPlaces}</td><td className="px-4 py-4 text-right">{row.fourthPlaces}</td><td className="px-4 py-4 text-right">{row.fifthPlaces}</td><td className="px-4 py-4 text-right">{row.combativeAwards}</td><td className="px-4 py-4 text-right">{row.sprintCount}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function AzzurraTable({ rows }: { rows: AzzurraLeaderboardRow[] }) {
  const incomplete = rows.some((row) => row.missingElevationCount > 0);
  return (
    <>
      {incomplete ? <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" aria-hidden /><p>Einige Fahrten besitzen noch keine synchronisierten Höhenmeter. Die betroffenen Zeilen sind markiert.</p></div> : null}
      <div className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <details key={row.userId} className={cn("group rounded-lg border border-sky-200 bg-white shadow-line", row.missingElevationCount && "bg-amber-50/50")}>
            <summary className="focus-ring grid min-h-14 cursor-pointer list-none grid-cols-[3rem_minmax(0,1fr)_6rem_2rem] items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
              <RankMarker place={row.place} tone="azzurra" />
              <span className="min-w-0 truncate font-medium text-asphalt-900">{row.displayName}</span>
              <span className="text-right font-bold text-sky-800">{number(row.totalElevationGainM)} m</span>
              <ChevronDown aria-hidden className="h-5 w-5 text-asphalt-500 transition group-open:rotate-180" />
            </summary>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-sky-100 bg-sky-50/50 px-4 py-3 text-sm">
              <Detail label="Kilometer" value={`${number(row.totalDistanceM / 1000)} km`} /><Detail label="Fahrten" value={row.rideCount} />
              <Detail label="Von" value={date(row.startsOn)} /><Detail label="Bis" value={date(row.endsOn)} />
              {row.missingElevationCount ? <Detail label="Höhenmeter offen" value={row.missingElevationCount} /> : null}
            </dl>
          </details>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-sky-200 bg-white shadow-line md:block">
        <table className="min-w-[840px] w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-sky-900"><tr><th className="px-4 py-3">Platz</th><th className="px-4 py-3">Fahrer</th><th className="px-4 py-3 text-right">Höhenmeter</th><th className="px-4 py-3 text-right">Kilometer</th><th className="px-4 py-3 text-right">Fahrten</th><th className="px-4 py-3">Wertungswoche</th></tr></thead>
          <tbody className="divide-y divide-asphalt-100">{rows.map((row) => <tr key={row.userId} className={row.missingElevationCount ? "bg-amber-50/50" : undefined}><RankCell place={row.place} tone="azzurra" /><td className="px-4 py-4 font-medium">{row.displayName}{row.missingElevationCount ? <span className="ml-2 text-xs text-amber-800">{row.missingElevationCount} offen</span> : null}</td><td className="px-4 py-4 text-right font-semibold">{number(row.totalElevationGainM)} m</td><td className="px-4 py-4 text-right">{number(row.totalDistanceM / 1000)} km</td><td className="px-4 py-4 text-right">{row.rideCount}</td><td className="px-4 py-4">{date(row.startsOn)} – {date(row.endsOn)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function RankCell({ place, tone }: { place: number; tone: "ciclamino" | "azzurra" }) { return <td className="px-4 py-4 font-semibold"><RankMarker place={place} tone={tone} /></td>; }
function RankMarker({ place, tone }: { place: number; tone: "ciclamino" | "azzurra" }) {
  const Icon = tone === "ciclamino" ? Flag : Mountain;
  return <span className="inline-flex items-center gap-1.5 font-semibold text-asphalt-900"><span className="flex h-6 w-6 shrink-0 items-center justify-center">{place === 1 ? <Icon className={cn("h-5 w-5", tone === "ciclamino" ? "text-fuchsia-700" : "text-sky-700")} aria-hidden /> : place <= 3 ? <Trophy className={cn("h-4 w-4", place === 2 ? "text-slate-400" : "text-amber-700")} aria-hidden /> : null}</span>{place}</span>;
}
function Detail({ label, value }: { label: string; value: number | string }) { return <div className="rounded-md bg-asphalt-50 p-2"><dt className="text-xs text-asphalt-500">{label}</dt><dd className="mt-1 font-semibold text-asphalt-900">{value}</dd></div>; }
const formatter = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });
function number(value: number) { return formatter.format(value); }
function date(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }

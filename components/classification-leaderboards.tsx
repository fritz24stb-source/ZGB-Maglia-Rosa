import Link from "next/link";
import { AlertTriangle, Flag, Mountain, Trophy } from "lucide-react";
import type {
  AzzurraLeaderboardRow,
  CiclaminoLeaderboardRow,
  ClassificationKind,
  ClassificationLeaderboardResponse,
} from "@/lib/classifications/types";
import { cn } from "@/lib/ui";

export function ClassificationTabs({
  active,
  enabled,
  seasonId,
}: {
  active: ClassificationKind;
  enabled: boolean;
  seasonId?: string | null;
}) {
  const tabs: { key: ClassificationKind; label: string; color: string }[] = [
    { key: "rosa", label: "Maglia Rosa", color: "border-pink-500 text-pink-800" },
    ...(enabled
      ? [
          { key: "ciclamino" as const, label: "Maglia Ciclamino", color: "border-fuchsia-600 text-fuchsia-800" },
          { key: "azzurra" as const, label: "Maglia Azzurra", color: "border-sky-600 text-sky-800" },
        ]
      : []),
  ];

  return (
    <nav aria-label="Trikotwertung" className="grid gap-2 sm:grid-cols-3">
      {tabs.map((tab) => {
        const params = new URLSearchParams({ classification: tab.key });
        if (seasonId) params.set("seasonId", seasonId);
        return (
          <Link
            key={tab.key}
            href={`/leaderboard?${params}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "focus-ring rounded-lg border bg-white px-4 py-3 text-center text-sm font-semibold shadow-line",
              active === tab.key ? tab.color : "border-asphalt-200 text-asphalt-600",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ClassificationLeaderboard({
  active,
  data,
}: {
  active: "ciclamino" | "azzurra";
  data: ClassificationLeaderboardResponse;
}) {
  const rows = active === "ciclamino" ? data.ciclamino : data.azzurra;
  return (
    <section className="flex flex-col gap-4">
      <form action="/leaderboard" className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
        <input type="hidden" name="classification" value={active} />
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-asphalt-800">
          Saison
          <select name="seasonId" defaultValue={data.selectedSeasonId ?? ""} className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm">
            {data.seasons.map((season) => (
              <option key={season.id} value={season.id}>{season.name}{season.isActive ? " (aktiv)" : ""}</option>
            ))}
          </select>
        </label>
        <button className="focus-ring mt-3 min-h-10 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white" type="submit">Anzeigen</button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">
          Für diese Saison gibt es noch keine Teilnehmer in der gewählten Wertung.
        </p>
      ) : active === "ciclamino" ? (
        <CiclaminoTable rows={data.ciclamino} />
      ) : (
        <AzzurraTable rows={data.azzurra} />
      )}
    </section>
  );
}

function CiclaminoTable({ rows }: { rows: CiclaminoLeaderboardRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-fuchsia-200 bg-white shadow-line">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="bg-fuchsia-50 text-xs uppercase text-fuchsia-900"><tr><th className="px-4 py-3">Platz</th><th className="px-4 py-3">Fahrer</th><th className="px-4 py-3 text-right">Punkte</th><th className="px-4 py-3 text-right">Siege</th><th className="px-4 py-3 text-right">2. Plätze</th><th className="px-4 py-3 text-right">3. Plätze</th></tr></thead>
        <tbody className="divide-y divide-asphalt-100">
          {rows.map((row) => <tr key={row.userId}><RankCell place={row.place} tone="ciclamino" /><td className="px-4 py-4 font-medium">{row.displayName}</td><td className="px-4 py-4 text-right font-semibold">{row.totalPoints}</td><td className="px-4 py-4 text-right">{row.wins}</td><td className="px-4 py-4 text-right">{row.secondPlaces}</td><td className="px-4 py-4 text-right">{row.thirdPlaces}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function AzzurraTable({ rows }: { rows: AzzurraLeaderboardRow[] }) {
  const incomplete = rows.some((row) => row.missingElevationCount > 0);
  return (
    <>
      {incomplete ? <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" aria-hidden /><p>Einige Fahrten besitzen noch keine synchronisierten Höhenmeter. Die betroffenen Zeilen sind markiert.</p></div> : null}
      <div className="overflow-x-auto rounded-lg border border-sky-200 bg-white shadow-line">
        <table className="min-w-[840px] w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-sky-900"><tr><th className="px-4 py-3">Platz</th><th className="px-4 py-3">Fahrer</th><th className="px-4 py-3 text-right">Höhenmeter</th><th className="px-4 py-3 text-right">Kilometer</th><th className="px-4 py-3 text-right">Fahrten</th><th className="px-4 py-3">Wertungswoche</th></tr></thead>
          <tbody className="divide-y divide-asphalt-100">
            {rows.map((row) => <tr key={row.userId} className={row.missingElevationCount ? "bg-amber-50/50" : undefined}><RankCell place={row.place} tone="azzurra" /><td className="px-4 py-4 font-medium">{row.displayName}{row.missingElevationCount ? <span className="ml-2 text-xs text-amber-800">{row.missingElevationCount} offen</span> : null}</td><td className="px-4 py-4 text-right font-semibold">{number(row.totalElevationGainM)} m</td><td className="px-4 py-4 text-right">{number(row.totalDistanceM / 1000)} km</td><td className="px-4 py-4 text-right">{row.rideCount}</td><td className="px-4 py-4">{date(row.startsOn)} – {date(row.endsOn)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RankCell({ place, tone }: { place: number; tone: "ciclamino" | "azzurra" }) {
  const Icon = tone === "ciclamino" ? Flag : Mountain;
  return <td className="px-4 py-4 font-semibold"><span className="inline-flex items-center gap-2">{place === 1 ? <Icon className={cn("h-5 w-5", tone === "ciclamino" ? "text-fuchsia-700" : "text-sky-700")} aria-hidden /> : place <= 3 ? <Trophy className="h-4 w-4 text-amber-600" aria-hidden /> : null}{place}</span></td>;
}

const formatter = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });
function number(value: number) { return formatter.format(value); }
function date(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }

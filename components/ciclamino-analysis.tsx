import { Award, Flag, Gauge, UsersRound } from "lucide-react";
import { buildCiclaminoAnalysis } from "@/lib/analysis/ciclamino";
import type { CiclaminoLeaderboardRow, CiclaminoSprintDay } from "@/lib/classifications/types";

export function CiclaminoAnalysis({ leaderboard, sprintDays }: { leaderboard: CiclaminoLeaderboardRow[]; sprintDays: CiclaminoSprintDay[] }) {
  const analysis = buildCiclaminoAnalysis(leaderboard, sprintDays);
  const maxPoints = Math.max(1, ...analysis.rows.slice(0, 8).map((row) => row.totalPoints));
  return <section className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Flag} label="Sprinttage" value={analysis.summary.sprintDays} />
      <Metric icon={UsersRound} label="Fahrer mit Punkten" value={analysis.summary.participatingRiders} />
      <Metric icon={Award} label="Vergebene Sprintpunkte" value={analysis.summary.awardedPoints} />
      <Metric icon={Gauge} label="Abgeschlossenes Voting" value={analysis.summary.completedDays} />
    </div>
    <section className="rounded-lg border border-fuchsia-200 bg-white p-4 shadow-line">
      <h2 className="text-base font-semibold text-asphalt-900">Punktevergleich</h2>
      <p className="mt-1 text-sm text-asphalt-600">Top-Fahrer nach Gesamtpunkten; Balken bleiben auch auf mobilen Geräten gut vergleichbar.</p>
      {analysis.rows.length ? <div className="mt-4 grid gap-3">{analysis.rows.slice(0, 8).map((row) => <div key={row.userId} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3"><div><div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate font-medium text-asphalt-900">{row.place}. {row.displayName}</span><span className="shrink-0 text-asphalt-600">{row.sprintCount} Platz.</span></div><div className="h-3 overflow-hidden rounded-full bg-fuchsia-100"><div className="h-full rounded-full bg-fuchsia-700" style={{ width: `${(row.totalPoints / maxPoints) * 100}%` }} /></div></div><span className="text-right text-sm font-semibold text-fuchsia-900">{row.totalPoints} P</span></div>)}</div> : <Empty />}
    </section>
    <section className="rounded-lg border border-asphalt-200 bg-white shadow-line">
      <div className="border-b border-asphalt-100 p-4"><h2 className="text-base font-semibold text-asphalt-900">Sprintbilanz je Fahrer</h2><p className="mt-1 text-sm text-asphalt-600">Teilnahmen, Podien und durchschnittliche Punkte pro Platzierung.</p></div>
      {analysis.rows.length ? <div className="divide-y divide-asphalt-100">{analysis.rows.map((row) => <article key={row.userId} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center"><div><p className="font-semibold text-asphalt-900">{row.place}. {row.displayName}</p><p className="text-sm text-asphalt-600">{row.totalPoints} Punkte · {row.combativeAwards}× Most Combative</p></div><Datum label="Platzierungen" value={row.sprintCount} /><Datum label="Podien" value={row.podiums} /><Datum label="Ø Punkte" value={row.averagePoints.toFixed(1)} /></article>)}</div> : <Empty />}
    </section>
  </section>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Flag; label: string; value: number }) { return <article className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line"><Icon className="h-5 w-5 text-fuchsia-700" aria-hidden /><p className="mt-3 text-xs font-semibold uppercase text-asphalt-500">{label}</p><p className="mt-1 text-2xl font-semibold text-asphalt-900">{value}</p></article>; }
function Datum({ label, value }: { label: string; value: number | string }) { return <div className="rounded-md bg-asphalt-50 px-3 py-2 text-sm sm:text-right"><p className="text-xs text-asphalt-500">{label}</p><p className="font-semibold text-asphalt-900">{value}</p></div>; }
function Empty() { return <p className="p-4 text-sm text-asphalt-600">Noch keine eingetragenen Sprintplatzierungen für diese Saison.</p>; }

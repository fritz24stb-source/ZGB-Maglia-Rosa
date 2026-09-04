import { Award, Flag, Gauge, UsersRound } from "lucide-react";
import { buildCiclaminoAnalysis } from "@/lib/analysis/ciclamino";
import type { CiclaminoLeaderboardRow, CiclaminoSprintDay } from "@/lib/classifications/types";

const COLORS = ["#a21caf", "#be123c", "#0369a1", "#047857", "#b45309"];

export function CiclaminoAnalysis({ leaderboard, sprintDays }: { leaderboard: CiclaminoLeaderboardRow[]; sprintDays: CiclaminoSprintDay[] }) {
  const analysis = buildCiclaminoAnalysis(leaderboard, sprintDays);
  const maxPoints = Math.max(1, ...analysis.recentRows.slice(0, 8).map((row) => row.points));
  return <section className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Flag} label="Sprinttage" value={analysis.summary.sprintDays} /><Metric icon={UsersRound} label="Fahrer mit Punkten" value={analysis.summary.participatingRiders} /><Metric icon={Award} label="Vergebene Sprintpunkte" value={analysis.summary.awardedPoints} /><Metric icon={Gauge} label="Abgeschlossenes Voting" value={analysis.summary.completedDays} /></div>
    <section className="rounded-lg border border-fuchsia-200 bg-white p-4 shadow-line"><h2 className="text-base font-semibold text-asphalt-900">Punktevergleich – letzte 3 Wochen</h2><p className="mt-1 text-sm text-asphalt-600">Sprint- und bereits entschiedene Combative-Punkte der letzten drei Sprintwochen.</p>{analysis.recentRows.length ? <div className="mt-4 grid gap-3">{analysis.recentRows.slice(0, 8).map((row) => <div key={row.userId} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3"><div><p className="mb-1 truncate text-sm font-medium text-asphalt-900">{row.displayName}</p><div className="h-3 overflow-hidden rounded-full bg-fuchsia-100"><div className="h-full rounded-full bg-fuchsia-700" style={{ width: `${(row.points / maxPoints) * 100}%` }} /></div></div><span className="text-right text-sm font-semibold text-fuchsia-900">{row.points} P</span></div>)}</div> : <Empty />}</section>
    <Trend trend={analysis.trend} />
    <section className="rounded-lg border border-asphalt-200 bg-white shadow-line"><div className="border-b border-asphalt-100 p-4"><h2 className="text-base font-semibold text-asphalt-900">Beste Platzierungen</h2><p className="mt-1 text-sm text-asphalt-600">Fahrer mit den meisten jeweiligen Sprintplatzierungen in der Saison.</p></div><div className="grid gap-px bg-asphalt-100 sm:grid-cols-5">{analysis.finishLeaders.map((leader) => <article key={leader.place} className="bg-white p-4"><p className="text-xs font-semibold uppercase text-asphalt-500">{leader.place}. Plätze</p><p className="mt-1 text-2xl font-semibold text-fuchsia-800">{leader.count}</p><p className="mt-2 text-sm text-asphalt-700">{leader.names.length ? leader.names.join(", ") : "Noch keine"}</p></article>)}</div></section>
  </section>;
}

function Trend({ trend }: { trend: ReturnType<typeof buildCiclaminoAnalysis>["trend"] }) {
  const riders = [...(trend.at(-1)?.values ?? [])].sort((left, right) => right.totalPoints - left.totalPoints).slice(0, 5).map((value) => [value.userId, value.displayName] as const);
  const max = Math.max(1, ...trend.flatMap((day) => day.values.map((value) => value.totalPoints)));
  if (!trend.length || !riders.length) return <section className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line"><h2 className="text-base font-semibold text-asphalt-900">Punkteverlauf je Fahrer</h2><Empty /></section>;
  const width = 720, height = 300, left = 64, right = 20, top = 18, bottom = 62;
  const yStep = niceTickStep(max / 4);
  const yMax = Math.ceil(max / yStep) * yStep;
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, index) => index * yStep);
  const xTickCount = Math.min(7, trend.length);
  const xTickIndexes = [...new Set(Array.from({ length: xTickCount }, (_, index) => (
    xTickCount === 1 ? 0 : Math.round(index * (trend.length - 1) / (xTickCount - 1))
  )))];
  const x = (index: number) => trend.length === 1 ? (width + left - right) / 2 : left + index * ((width - left - right) / (trend.length - 1));
  const y = (value: number) => top + (yMax - value) * ((height - top - bottom) / yMax);
  return <section className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
    <h2 className="text-base font-semibold text-asphalt-900">Punkteverlauf je Fahrer</h2>
    <p className="mt-1 text-sm text-asphalt-600">Kumulierte Sprintpunkte zeigen die Tendenz über die Saison.</p>
    <svg role="img" aria-label="Kumulierter Punkteverlauf der führenden Fahrer" className="mt-4 h-auto w-full" viewBox={`0 0 ${width} ${height}`}>
      <title>Kumulierter Punkteverlauf mit Sprintdatum und Punkteskala</title>
      {yTicks.map((tick) => <g key={tick}>
        <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#ded8d0" strokeWidth="1" />
        <text x={left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#756856">{tick}</text>
      </g>)}
      {xTickIndexes.map((index) => <line key={trend[index].date} x1={x(index)} x2={x(index)} y1={top} y2={height - bottom} stroke="#eeeae5" strokeWidth="1" />)}
      <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="#b9afa3" strokeWidth="1" />
      <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#b9afa3" strokeWidth="1" />
      <text x="16" y={(top + height - bottom) / 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="#4d443a" transform={`rotate(-90 16 ${(top + height - bottom) / 2})`}>Punkte</text>
      {riders.map(([userId], index) => {
        const points = trend.map((day, dayIndex) => {
          const value = day.values.find((candidate) => candidate.userId === userId)?.totalPoints ?? (dayIndex ? trend[dayIndex - 1].values.find((candidate) => candidate.userId === userId)?.totalPoints ?? 0 : 0);
          return `${x(dayIndex)},${y(value)}`;
        }).join(" ");
        return <polyline key={userId} fill="none" points={points} stroke={COLORS[index]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
      })}
      {xTickIndexes.map((index) => <text key={trend[index].date} x={x(index)} y={height - bottom + 20} textAnchor="middle" fontSize="11" fill="#756856">{formatShortDate(trend[index].date)}</text>)}
      <text x={(left + width - right) / 2} y={height - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#4d443a">Sprintdatum</text>
    </svg>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">{riders.map(([userId, name], index) => <span key={userId} className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />{name}</span>)}</div>
  </section>;
}

function niceTickStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(1, factor * magnitude);
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return day && month ? `${day}.${month}.` : date;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Flag; label: string; value: number }) { return <article className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line"><Icon className="h-5 w-5 text-fuchsia-700" aria-hidden /><p className="mt-3 text-xs font-semibold uppercase text-asphalt-500">{label}</p><p className="mt-1 text-2xl font-semibold text-asphalt-900">{value}</p></article>; }
function Empty() { return <p className="mt-4 text-sm text-asphalt-600">Noch keine eingetragenen Sprintplatzierungen für diese Saison.</p>; }

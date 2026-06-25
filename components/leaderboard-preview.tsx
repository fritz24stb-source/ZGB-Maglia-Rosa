import { ArrowDownUp, Filter } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { leaderboardPreviewRows } from "@/lib/mock-data";

export function LeaderboardPreview() {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-lg border border-asphalt-200 bg-white p-4 shadow-line md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
          Saison
          <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900">
            <option>2026</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
          Kategorie
          <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900">
            <option>Alle</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
          Quelle
          <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900">
            <option>Alle</option>
          </select>
        </label>
        <button
          type="button"
          className="focus-ring mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
        >
          <Filter aria-hidden className="h-4 w-4" />
          Filter anwenden
        </button>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-[65px] bg-asphalt-50 text-xs uppercase text-asphalt-500">
            <tr>
              <th className="px-4 py-3">Platz</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  Punkte
                  <ArrowDownUp aria-hidden className="h-3.5 w-3.5" />
                </span>
              </th>
              <th className="px-4 py-3">Fahrten</th>
              <th className="px-4 py-3">Fondo</th>
              <th className="px-4 py-3">Mittwoch</th>
              <th className="px-4 py-3">Sonderevents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-asphalt-100">
            {leaderboardPreviewRows.map((row) => (
              <tr key={row.rank}>
                <td className="px-4 py-4 font-semibold text-asphalt-900">
                  {row.rank}
                </td>
                <td className="px-4 py-4 text-asphalt-900">{row.name}</td>
                <td className="px-4 py-4 font-semibold text-asphalt-900">
                  {row.points}
                </td>
                <td className="px-4 py-4 text-asphalt-700">{row.rides}</td>
                <td className="px-4 py-4 text-asphalt-700">{row.fondo}</td>
                <td className="px-4 py-4 text-asphalt-700">{row.midweek}</td>
                <td className="px-4 py-4 text-asphalt-700">{row.special}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {leaderboardPreviewRows.map((row) => (
          <article
            key={row.rank}
            className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-asphalt-500">
                  Platz {row.rank}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-asphalt-900">
                  {row.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-asphalt-900">
                  {row.points}
                </p>
                <p className="text-xs text-asphalt-500">Punkte</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Metric label="Fahrten" value={row.rides} />
              <Metric label="Fondo" value={row.fondo} />
              <Metric label="Mi." value={row.midweek} />
            </div>
            {row.special > 0 ? (
              <div className="mt-3">
                <StatusBadge tone="info">Sonderevent: {row.special}</StatusBadge>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-asphalt-50 p-2">
      <p className="text-xs text-asphalt-500">{label}</p>
      <p className="mt-1 font-semibold text-asphalt-900">{value}</p>
    </div>
  );
}

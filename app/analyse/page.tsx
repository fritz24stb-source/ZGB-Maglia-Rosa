import { Activity, BarChart3, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireActiveAppPage } from "@/lib/auth/page-guard";
import {
  buildRideAnalysis,
  type AnalysisActivity,
  type AnalysisScoringRule,
  type RideAnalysis,
  type RideAnalysisRow,
  type WednesdayParticipationPoint,
} from "@/lib/analysis/rides";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SeasonRow = Pick<
  Database["public"]["Tables"]["seasons"]["Row"],
  "ends_on" | "id" | "is_active" | "name" | "starts_on"
>;
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id">;

type AnalysisPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AnalysisState =
  | {
      kind: "ready";
      analysis: RideAnalysis;
      seasons: SeasonRow[];
      selectedSeason: SeasonRow | null;
      selectedSeasonId: string | null;
    }
  | { kind: "error"; message: string };

const numberFormatter = new Intl.NumberFormat("de-CH");
const averageFormatter = new Intl.NumberFormat("de-CH", {
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

export const dynamic = "force-dynamic";

export default async function AnalysePage({ searchParams }: AnalysisPageProps) {
  const accessBlocked = await requireActiveAppPage("/analyse");

  if (accessBlocked) {
    return accessBlocked;
  }

  const params = searchParams ? await searchParams : {};
  const state = await loadAnalysisState(params);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Analyse"
        description="Gruppenfahrten nach Datum, Teilnehmern und Wertungskategorie."
      />

      {state.kind === "error" ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {state.message}
        </section>
      ) : (
        <AnalysisContent state={state} />
      )}
    </main>
  );
}

function AnalysisContent({
  state,
}: {
  state: Extract<AnalysisState, { kind: "ready" }>;
}) {
  const { analysis, selectedSeason } = state;

  return (
    <>
      <section className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-asphalt-900">
              Saisonauswahl
            </h2>
            <p className="mt-1 text-sm text-asphalt-600">
              {selectedSeason
                ? `${selectedSeason.name}: ${formatDateKey(
                    selectedSeason.starts_on,
                  )} bis ${formatDateKey(selectedSeason.ends_on)}`
                : "Keine Saison vorhanden."}
            </p>
          </div>
          <SeasonFilter
            seasons={state.seasons}
            selectedSeasonId={state.selectedSeasonId}
          />
        </div>
      </section>

      <SummaryGrid analysis={analysis} />
      <WednesdayParticipationChart points={analysis.wednesdayGraph} />

      <RideTable
        columns={[
          { key: "date", label: "Datum" },
          { key: "title", label: "Fahrt" },
          { key: "participantCount", label: "Teilnehmer" },
          { key: "scuderiaCount", label: "Scuderia" },
          { key: "zugCount", label: "Zug" },
          { key: "scuolaCount", label: "Scuola" },
        ]}
        emptyText="Keine gewerteten Mittwochsfahrten gefunden."
        rows={analysis.wednesdayRides}
        title="Mittwochsfahrten"
      />

      <RideTable
        columns={[
          { key: "date", label: "Datum" },
          { key: "title", label: "Fahrt" },
          { key: "participantCount", label: "Teilnehmer" },
        ]}
        emptyText="Keine gewerteten Samstags-Fondo-Fahrten gefunden."
        rows={analysis.fondoRides}
        title="Samstags-Fondo"
      />

      <RideTable
        columns={[
          { key: "date", label: "Datum" },
          { key: "title", label: "Event" },
          { key: "participantCount", label: "Teilnehmer" },
        ]}
        emptyText="Keine gewerteten Sonderevents gefunden."
        rows={analysis.eventRides}
        title="Events"
      />
    </>
  );
}

function SeasonFilter({
  seasons,
  selectedSeasonId,
}: {
  seasons: SeasonRow[];
  selectedSeasonId: string | null;
}) {
  if (seasons.length === 0) {
    return null;
  }

  return (
    <form action="/analyse" className="flex flex-col gap-2 sm:flex-row">
      <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
        Saison
        <select
          className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
          defaultValue={selectedSeasonId ?? seasons[0]?.id}
          name="seasonId"
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
              {season.is_active ? " (aktiv)" : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="focus-ring mt-auto inline-flex min-h-10 items-center justify-center rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
      >
        Anzeigen
      </button>
    </form>
  );
}

function SummaryGrid({ analysis }: { analysis: RideAnalysis }) {
  const items = [
    {
      icon: CalendarDays,
      label: "Ø Mittwoch",
      value: analysis.summary.wednesdayParticipantAverage,
    },
    {
      icon: Activity,
      label: "Ø Fondo",
      value: analysis.summary.fondoParticipantAverage,
    },
    {
      icon: BarChart3,
      label: "Ø Events",
      value: analysis.summary.eventParticipantAverage,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <article
            className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line"
            key={item.label}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-asphalt-50 text-signal-blue">
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-asphalt-500">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-asphalt-900">
                  {formatAverage(item.value)}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function WednesdayParticipationChart({
  points,
}: {
  points: WednesdayParticipationPoint[];
}) {
  const width = 640;
  const height = 260;
  const padding = { bottom: 58, left: 44, right: 24, top: 24 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxParticipants = Math.max(
    1,
    ...points.map((point) => point.participantCount),
  );
  const xForIndex = (index: number) =>
    points.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + (index / (points.length - 1)) * plotWidth;
  const yForValue = (value: number) =>
    padding.top + ((maxParticipants - value) / maxParticipants) * plotHeight;
  const graphPoints = points.map((point, index) => ({
    ...point,
    x: xForIndex(index),
    y: yForValue(point.participantCount),
  }));
  const linePoints = graphPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const areaPoints =
    graphPoints.length > 0
      ? [
          `${graphPoints[0].x},${padding.top + plotHeight}`,
          ...graphPoints.map((point) => `${point.x},${point.y}`),
          `${graphPoints[graphPoints.length - 1].x},${
            padding.top + plotHeight
          }`,
        ].join(" ")
      : "";
  const yTicks = uniqueNumbers([
    maxParticipants,
    Math.round(maxParticipants / 2),
    0,
  ]);

  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-asphalt-900">
            Teilnahme Mittwochsfahrten
          </h2>
          <p className="text-sm text-asphalt-600">
            Teilnehmer je ZGB-Zug-Termin im Saisonverlauf.
          </p>
        </div>
        <p className="text-sm font-medium text-asphalt-700">
          Maximum:{" "}
          {formatNumber(Math.max(0, ...points.map((p) => p.participantCount)))}
        </p>
      </div>

      {points.length === 0 ? (
        <p className="mt-4 rounded-md bg-asphalt-50 p-4 text-sm text-asphalt-600">
          Keine Daten fuer den Graph vorhanden.
        </p>
      ) : (
        <svg
          aria-label="Teilnahme der Mittwochsfahrten ueber die Saison"
          className="mt-4 h-auto w-full overflow-visible"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {yTicks.map((tick) => {
            const y = yForValue(tick);

            return (
              <g key={tick}>
                <line
                  stroke="#ecdeca"
                  strokeWidth="1"
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="#756856"
                  fontSize="12"
                  textAnchor="end"
                  x={padding.left - 8}
                  y={y + 4}
                >
                  {tick}
                </text>
              </g>
            );
          })}
          {areaPoints ? (
            <polygon fill="rgba(0, 66, 37, 0.1)" points={areaPoints} />
          ) : null}
          <polyline
            fill="none"
            points={linePoints}
            stroke="#004225"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {graphPoints.map((point) => (
            <circle
              cx={point.x}
              cy={point.y}
              fill="#004225"
              key={point.date}
              r="4"
            >
              <title>
                {formatDateKey(point.date)}:{" "}
                {formatNumber(point.participantCount)} Teilnehmer
              </title>
            </circle>
          ))}
          <line
            stroke="#c7b79f"
            strokeWidth="1"
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
          />
          {graphPoints.map((point) => (
            <text
              fill="#756856"
              fontSize="11"
              key={`axis-${point.date}`}
              textAnchor="end"
              transform={`rotate(-45 ${point.x} ${height - 12})`}
              x={point.x}
              y={height - 12}
            >
              {formatAxisDateKey(point.date)}
            </text>
          ))}
        </svg>
      )}
    </section>
  );
}

function RideTable({
  columns,
  emptyText,
  rows,
  title,
}: {
  columns: {
    key:
      | "date"
      | "participantCount"
      | "scuderiaCount"
      | "scuolaCount"
      | "title"
      | "zugCount";
    label: string;
  }[];
  emptyText: string;
  rows: RideAnalysisRow[];
  title: string;
}) {
  return (
    <section className="rounded-lg border border-asphalt-200 bg-white shadow-line">
      <div className="border-b border-asphalt-100 p-4">
        <h2 className="text-base font-semibold text-asphalt-900">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-asphalt-600">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full border-collapse text-left text-sm">
            <thead className="bg-asphalt-50 text-xs uppercase text-asphalt-500">
              <tr>
                {columns.map((column) => (
                  <th className="whitespace-nowrap px-4 py-3" key={column.key}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-asphalt-100">
              {rows.map((row) => (
                <tr key={`${row.type}-${row.date}`}>
                  {columns.map((column) => (
                    <td
                      className="whitespace-nowrap px-4 py-4 text-asphalt-800"
                      key={column.key}
                    >
                      {formatRideTableValue(row, column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function loadAnalysisState(
  params: Record<string, string | string[] | undefined>,
): Promise<AnalysisState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const seasonsResult = await supabase
      .from("seasons")
      .select("id, name, starts_on, ends_on, is_active")
      .order("starts_on", { ascending: false });

    if (seasonsResult.error) {
      throw seasonsResult.error;
    }

    const seasons = (seasonsResult.data ?? []) as SeasonRow[];
    const selectedSeasonId = resolveSelectedSeasonId(
      getSingleParam(params.seasonId),
      seasons,
    );
    const selectedSeason =
      seasons.find((season) => season.id === selectedSeasonId) ?? null;
    const [rulesResult, profilesResult, activitiesResult] = await Promise.all([
      supabase
        .from("scoring_rules")
        .select("id, name, category, rule_type")
        .order("priority", { ascending: false }),
      supabase.from("profiles").select("id").eq("is_active", true),
      buildActivitiesQuery(supabase, selectedSeasonId),
    ]);

    if (rulesResult.error || profilesResult.error || activitiesResult.error) {
      throw rulesResult.error ?? profilesResult.error ?? activitiesResult.error;
    }

    const activeProfileIds = new Set(
      ((profilesResult.data ?? []) as ProfileRow[]).map(
        (profile) => profile.id,
      ),
    );
    const activities = (
      (activitiesResult.data ?? []) as unknown as AnalysisActivity[]
    ).filter((activity) => activeProfileIds.has(activity.user_id));
    const analysis = buildRideAnalysis(
      activities,
      (rulesResult.data ?? []) as AnalysisScoringRule[],
    );

    return {
      analysis,
      kind: "ready",
      seasons,
      selectedSeason,
      selectedSeasonId,
    };
  } catch (error) {
    return {
      kind: "error",
      message: formatAnalysisLoadError(error),
    };
  }
}

function buildActivitiesQuery(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  selectedSeasonId: string | null,
) {
  let query = supabase
    .from("activities")
    .select(
      [
        "activity_name",
        "activity_started_at",
        "activity_started_local_at",
        "category",
        "matched_rule_id",
        "matched_rule_name",
        "user_id",
      ].join(", "),
    )
    .eq("status", "active")
    .gt("points", 0)
    .not("matched_rule_id", "is", null)
    .order("activity_started_at", { ascending: true })
    .limit(10000);

  if (selectedSeasonId) {
    query = query.eq("season_id", selectedSeasonId);
  }

  return query;
}

function resolveSelectedSeasonId(
  rawSeasonId: string | undefined,
  seasons: SeasonRow[],
) {
  if (rawSeasonId && seasons.some((season) => season.id === rawSeasonId)) {
    return rawSeasonId;
  }

  return (
    seasons.find((season) => season.is_active)?.id ?? seasons[0]?.id ?? null
  );
}

function formatRideTableValue(
  row: RideAnalysisRow,
  key:
    | "date"
    | "participantCount"
    | "scuderiaCount"
    | "scuolaCount"
    | "title"
    | "zugCount",
) {
  switch (key) {
    case "date":
      return formatDateKey(row.date);
    case "participantCount":
      return formatNumber(row.participantCount);
    case "scuderiaCount":
      return formatNumber(row.scuderiaCount);
    case "scuolaCount":
      return formatNumber(row.scuolaCount);
    case "title":
      return row.title;
    case "zugCount":
      return formatNumber(row.zugCount);
  }
}

function formatDateKey(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatAverage(value: number) {
  return averageFormatter.format(value);
}

function formatAxisDateKey(dateKey: string) {
  const [, month, day] = dateKey.split("-");

  return `${day}.${month}.`;
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)].sort((left, right) => right - left);
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatAnalysisLoadError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return [
      "Supabase ist lokal noch nicht konfiguriert.",
      "Bitte .env.local auf Basis von .env.example setzen.",
    ].join(" ");
  }

  return error instanceof Error
    ? error.message
    : "Analyse konnte nicht geladen werden.";
}

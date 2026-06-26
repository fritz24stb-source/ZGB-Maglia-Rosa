"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  Filter,
  Loader2,
  LogIn,
  RotateCcw,
  SearchX,
  Trophy,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/ui";
import type {
  LeaderboardResponse,
  LeaderboardRow,
  LeaderboardSortDirection,
  LeaderboardSortKey,
} from "@/lib/leaderboard/types";

type DraftFilters = {
  seasonId: string;
  category: string;
  source: string;
  sportType: string;
  from: string;
  to: string;
};

type LoadState = "loading" | "success" | "unauthorized" | "error";

const initialFilters: DraftFilters = {
  seasonId: "",
  category: "all",
  source: "all",
  sportType: "all",
  from: "",
  to: "",
};

const sortOptions: { key: LeaderboardSortKey; label: string }[] = [
  { key: "totalPoints", label: "Punkte" },
  { key: "totalRides", label: "Fahrten" },
  { key: "samstagsFahrten", label: "Fondo" },
  { key: "mittwochsFahrten", label: "Mittwoch" },
  { key: "sonderevents", label: "Sonderevents" },
  { key: "displayName", label: "Name" },
  { key: "lastActivityAt", label: "Letzte Aktivitaet" },
  { key: "place", label: "Platz" },
];

const numberFormatter = new Intl.NumberFormat("de-CH");

export function LeaderboardPreview() {
  const [draftFilters, setDraftFilters] =
    useState<DraftFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<DraftFilters>(initialFilters);
  const [sortKey, setSortKey] = useState<LeaderboardSortKey>("totalPoints");
  const [sortDirection, setSortDirection] =
    useState<LeaderboardSortDirection>("desc");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLeaderboard() {
      setLoadState((current) => (current === "success" ? current : "loading"));
      setErrorMessage(null);

      const params = buildSearchParams({
        filters: appliedFilters,
        sortKey,
        sortDirection,
      });
      const response = await fetch(`/api/leaderboard?${params}`, {
        signal: controller.signal,
      });
      const payload = (await response.json()) as
        | LeaderboardResponse
        | { error?: string };

      if (!response.ok) {
        if (response.status === 401) {
          setLoadState("unauthorized");
          setData(null);
          return;
        }

        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Leaderboard konnte nicht geladen werden.",
        );
      }

      setData(payload as LeaderboardResponse);
      setLoadState("success");
    }

    loadLeaderboard().catch((error: unknown) => {
      if (controller.signal.aborted) {
        return;
      }

      setLoadState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Leaderboard konnte nicht geladen werden.",
      );
    });

    return () => {
      controller.abort();
    };
  }, [appliedFilters, sortDirection, sortKey]);

  const selectedSeasonValue =
    draftFilters.seasonId || data?.filters.seasonId || "all";
  const summary = useMemo(() => summarizeRows(data?.rows ?? []), [data?.rows]);
  const isRefreshing = loadState === "success" && data === null;

  function updateDraftFilter(key: keyof DraftFilters, value: string) {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSortKey("totalPoints");
    setSortDirection("desc");
  }

  function updateSort(nextSortKey: LeaderboardSortKey) {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(defaultDirectionForSort(nextSortKey));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <SelectField
            label="Saison"
            value={selectedSeasonValue}
            onChange={(value) => updateDraftFilter("seasonId", value)}
          >
            <option value="all">Alle Saisons</option>
            {data?.options.seasons.map((season) => (
              <option key={season.value} value={season.value}>
                {season.label}
                {season.isActive ? " (aktiv)" : ""}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Kategorie"
            value={draftFilters.category}
            onChange={(value) => updateDraftFilter("category", value)}
          >
            <option value="all">Alle</option>
            {data?.options.categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Quelle"
            value={draftFilters.source}
            onChange={(value) => updateDraftFilter("source", value)}
          >
            <option value="all">Alle</option>
            {data?.options.sources.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Sportart"
            value={draftFilters.sportType}
            onChange={(value) => updateDraftFilter("sportType", value)}
          >
            <option value="all">Alle</option>
            {data?.options.sportTypes.map((sportType) => (
              <option key={sportType.value} value={sportType.value}>
                {sportType.label}
              </option>
            ))}
          </SelectField>

          <DateField
            label="Von"
            value={draftFilters.from}
            onChange={(value) => updateDraftFilter("from", value)}
          />
          <DateField
            label="Bis"
            value={draftFilters.to}
            onChange={(value) => updateDraftFilter("to", value)}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <SelectField
            label="Sortierung"
            value={sortKey}
            onChange={(value) => updateSort(value as LeaderboardSortKey)}
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <button
            type="button"
            className="focus-ring mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
            onClick={() =>
              setSortDirection((current) =>
                current === "desc" ? "asc" : "desc",
              )
            }
          >
            <ArrowDownUp aria-hidden className="h-4 w-4" />
            {sortDirection === "desc" ? "Absteigend" : "Aufsteigend"}
          </button>

          <button
            type="button"
            className="focus-ring mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
            onClick={applyFilters}
          >
            <Filter aria-hidden className="h-4 w-4" />
            Filter anwenden
          </button>

          <button
            type="button"
            className="focus-ring mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
            onClick={resetFilters}
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            Zuruecksetzen
          </button>
        </div>
      </div>

      {loadState === "loading" ? <LoadingState /> : null}
      {loadState === "unauthorized" ? <UnauthorizedState /> : null}
      {loadState === "error" ? <ErrorState message={errorMessage} /> : null}

      {loadState === "success" && data ? (
        <>
          <SummaryBar summary={summary} generatedAt={data.generatedAt} />
          {data.rows.length > 0 ? (
            <>
              <DesktopLeaderboard
                rows={data.rows}
                sortDirection={sortDirection}
                sortKey={sortKey}
                onSort={updateSort}
              />
              <MobileLeaderboard rows={data.rows} />
            </>
          ) : (
            <EmptyState />
          )}
          {isRefreshing ? <LoadingState compact /> : null}
        </>
      ) : null}
    </section>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <select
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function DateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SummaryBar({
  generatedAt,
  summary,
}: {
  generatedAt: string;
  summary: ReturnType<typeof summarizeRows>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      <SummaryMetric label="Mitglieder" value={summary.members} />
      <SummaryMetric label="Punkte" value={summary.points} />
      <SummaryMetric label="Fahrten" value={summary.rides} />
      <SummaryMetric label="Fondo" value={summary.fondos} />
      <SummaryMetric label="Mittwoch" value={summary.midweek} />
      <div className="flex items-center gap-2 text-xs text-asphalt-500 md:col-span-5">
        <CalendarDays aria-hidden className="h-4 w-4" />
        Stand: {formatDateTime(generatedAt)}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-asphalt-200 bg-white p-3 shadow-line">
      <p className="text-xs font-semibold uppercase text-asphalt-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-asphalt-900">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function DesktopLeaderboard({
  onSort,
  rows,
  sortDirection,
  sortKey,
}: {
  onSort: (sortKey: LeaderboardSortKey) => void;
  rows: LeaderboardRow[];
  sortDirection: LeaderboardSortDirection;
  sortKey: LeaderboardSortKey;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-[65px] bg-asphalt-50 text-xs uppercase text-asphalt-500">
          <tr>
            <SortableHeader
              active={sortKey === "place"}
              direction={sortDirection}
              label="Platz"
              onSort={() => onSort("place")}
            />
            <SortableHeader
              active={sortKey === "displayName"}
              direction={sortDirection}
              label="Name"
              onSort={() => onSort("displayName")}
            />
            <SortableHeader
              active={sortKey === "totalPoints"}
              direction={sortDirection}
              label="Punkte"
              onSort={() => onSort("totalPoints")}
            />
            <SortableHeader
              active={sortKey === "totalRides"}
              direction={sortDirection}
              label="Fahrten"
              onSort={() => onSort("totalRides")}
            />
            <SortableHeader
              active={sortKey === "samstagsFahrten"}
              direction={sortDirection}
              label="Fondo"
              onSort={() => onSort("samstagsFahrten")}
            />
            <SortableHeader
              active={sortKey === "mittwochsFahrten"}
              direction={sortDirection}
              label="Mittwoch"
              onSort={() => onSort("mittwochsFahrten")}
            />
            <SortableHeader
              active={sortKey === "sonderevents"}
              direction={sortDirection}
              label="Sonderevents"
              onSort={() => onSort("sonderevents")}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-asphalt-100">
          {rows.map((row) => (
            <tr key={`${row.seasonId}-${row.userId}`}>
              <td className="px-4 py-4 font-semibold text-asphalt-900">
                <span className="inline-flex items-center gap-2">
                  {row.place <= 3 ? (
                    <Trophy aria-hidden className="h-4 w-4 text-signal-amber" />
                  ) : null}
                  {row.place}
                </span>
              </td>
              <td className="px-4 py-4 text-asphalt-900">
                <div>
                  <p className="font-medium">{row.displayName}</p>
                  <p className="mt-1 text-xs text-asphalt-500">
                    {row.seasonName}
                  </p>
                </div>
              </td>
              <td className="px-4 py-4 font-semibold text-asphalt-900">
                {formatNumber(row.totalPoints)}
              </td>
              <td className="px-4 py-4 text-asphalt-700">
                {formatNumber(row.totalRides)}
              </td>
              <td className="px-4 py-4 text-asphalt-700">
                {formatNumber(row.samstagsFahrten)}
              </td>
              <td className="px-4 py-4 text-asphalt-700">
                {formatNumber(row.mittwochsFahrten)}
              </td>
              <td className="px-4 py-4 text-asphalt-700">
                {row.sonderevents > 0 ? (
                  <StatusBadge tone="info">
                    {formatNumber(row.sonderevents)}
                  </StatusBadge>
                ) : (
                  "0"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  active,
  direction,
  label,
  onSort,
}: {
  active: boolean;
  direction: LeaderboardSortDirection;
  label: string;
  onSort: () => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        className={cn(
          "focus-ring inline-flex items-center gap-1 rounded-sm font-semibold",
          active ? "text-asphalt-900" : "text-asphalt-500",
        )}
        onClick={onSort}
      >
        {label}
        <ArrowDownUp aria-hidden className="h-3.5 w-3.5" />
        <span className="sr-only">
          {active && direction === "desc" ? "absteigend" : "aufsteigend"}
        </span>
      </button>
    </th>
  );
}

function MobileLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <article
          key={`${row.seasonId}-${row.userId}`}
          className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-asphalt-500">
                Platz {row.place}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-asphalt-900">
                {row.displayName}
              </h2>
              <p className="mt-1 text-xs text-asphalt-500">{row.seasonName}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-asphalt-900">
                {formatNumber(row.totalPoints)}
              </p>
              <p className="text-xs text-asphalt-500">Punkte</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Fahrten" value={row.totalRides} />
            <Metric label="Fondo" value={row.samstagsFahrten} />
            <Metric label="Mittwoch" value={row.mittwochsFahrten} />
            <Metric label="Sonderevents" value={row.sonderevents} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-asphalt-500">
            <StatusBadge tone={row.manualPoints > 0 ? "warning" : "neutral"}>
              Manuell: {formatNumber(row.manualPoints)} P
            </StatusBadge>
            <span>
              Letzte Aktivitaet:{" "}
              {row.lastActivityAt ? formatDate(row.lastActivityAt) : "-"}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-asphalt-50 p-2">
      <p className="text-xs text-asphalt-500">{label}</p>
      <p className="mt-1 font-semibold text-asphalt-900">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function LoadingState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line",
        compact && "py-3",
      )}
    >
      <div className="flex items-center gap-2">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        Leaderboard wird geladen.
      </div>
    </div>
  );
}

function UnauthorizedState() {
  return (
    <div className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <LogIn aria-hidden className="mt-1 h-5 w-5 text-signal-blue" />
          <div>
            <h2 className="text-base font-semibold text-asphalt-900">
              Anmeldung erforderlich
            </h2>
            <p className="mt-1 text-sm leading-6 text-asphalt-600">
              Das Leaderboard ist fuer angemeldete Vereinsmitglieder sichtbar.
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
        >
          Zur Anmeldung
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-900">
      {message ?? "Leaderboard konnte nicht geladen werden."}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">
      <div className="flex items-start gap-3">
        <SearchX aria-hidden className="mt-0.5 h-5 w-5 text-asphalt-500" />
        <div>
          <h2 className="text-base font-semibold text-asphalt-900">
            Keine Eintraege gefunden
          </h2>
          <p className="mt-1 leading-6">
            Fuer die aktuellen Filter gibt es keine gewerteten Aktivitaeten.
          </p>
        </div>
      </div>
    </div>
  );
}

function buildSearchParams(input: {
  filters: DraftFilters;
  sortDirection: LeaderboardSortDirection;
  sortKey: LeaderboardSortKey;
}) {
  const params = new URLSearchParams();

  appendFilter(params, "seasonId", input.filters.seasonId);
  appendFilter(params, "category", input.filters.category);
  appendFilter(params, "source", input.filters.source);
  appendFilter(params, "sportType", input.filters.sportType);
  appendFilter(params, "from", input.filters.from);
  appendFilter(params, "to", input.filters.to);
  params.set("sort", input.sortKey);
  params.set("direction", input.sortDirection);

  return params;
}

function appendFilter(params: URLSearchParams, key: string, value: string) {
  if (!value) {
    return;
  }

  params.set(key, value);
}

function summarizeRows(rows: LeaderboardRow[]) {
  return rows.reduce(
    (summary, row) => ({
      members: summary.members + 1,
      points: summary.points + row.totalPoints,
      rides: summary.rides + row.totalRides,
      fondos: summary.fondos + row.samstagsFahrten,
      midweek: summary.midweek + row.mittwochsFahrten,
    }),
    {
      members: 0,
      points: 0,
      rides: 0,
      fondos: 0,
      midweek: 0,
    },
  );
}

function defaultDirectionForSort(
  nextSortKey: LeaderboardSortKey,
): LeaderboardSortDirection {
  return nextSortKey === "displayName" || nextSortKey === "place"
    ? "asc"
    : "desc";
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

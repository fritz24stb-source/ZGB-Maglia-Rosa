"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  ChevronDown,
  Filter,
  Loader2,
  LogIn,
  RotateCcw,
  SearchX,
  Trophy,
} from "lucide-react";
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
  { key: "lastActivityAt", label: "Letzte Aktivität" },
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
  const isRefreshing = loadState === "success" && data === null;

  function updateDraftFilter(key: keyof DraftFilters, value: string) {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setMobileFiltersOpen(false);
  }

  function resetFilters() {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSortKey("totalPoints");
    setSortDirection("desc");
    setMobileFiltersOpen(false);
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
      <LeaderboardFilters
        data={data}
        draftFilters={draftFilters}
        mobileFiltersOpen={mobileFiltersOpen}
        onApply={applyFilters}
        onDraftFilterChange={updateDraftFilter}
        onMobileFiltersOpenChange={setMobileFiltersOpen}
        onReset={resetFilters}
        onSortDirectionToggle={() =>
          setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
        }
        onSortKeyChange={updateSort}
        selectedSeasonValue={selectedSeasonValue}
        sortDirection={sortDirection}
        sortKey={sortKey}
      />

      {loadState === "loading" ? <LoadingState /> : null}
      {loadState === "unauthorized" ? <UnauthorizedState /> : null}
      {loadState === "error" ? <ErrorState message={errorMessage} /> : null}

      {loadState === "success" && data ? (
        <>
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

function LeaderboardFilters({
  data,
  draftFilters,
  mobileFiltersOpen,
  onApply,
  onDraftFilterChange,
  onMobileFiltersOpenChange,
  onReset,
  onSortDirectionToggle,
  onSortKeyChange,
  selectedSeasonValue,
  sortDirection,
  sortKey,
}: {
  data: LeaderboardResponse | null;
  draftFilters: DraftFilters;
  mobileFiltersOpen: boolean;
  onApply: () => void;
  onDraftFilterChange: (key: keyof DraftFilters, value: string) => void;
  onMobileFiltersOpenChange: (open: boolean) => void;
  onReset: () => void;
  onSortDirectionToggle: () => void;
  onSortKeyChange: (sortKey: LeaderboardSortKey) => void;
  selectedSeasonValue: string;
  sortDirection: LeaderboardSortDirection;
  sortKey: LeaderboardSortKey;
}) {
  return (
    <>
      <details
        className="group rounded-lg border border-asphalt-200 bg-white shadow-line md:hidden"
        onToggle={(event) =>
          onMobileFiltersOpenChange(event.currentTarget.open)
        }
        open={mobileFiltersOpen}
      >
        <summary className="focus-ring flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 text-sm font-semibold text-asphalt-900 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Filter aria-hidden className="h-4 w-4" />
            Filter
          </span>
          <ChevronDown
            aria-hidden
            className="h-4 w-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-asphalt-100 p-4">
          <LeaderboardFilterFields
            data={data}
            draftFilters={draftFilters}
            onApply={onApply}
            onDraftFilterChange={onDraftFilterChange}
            onReset={onReset}
            onSortDirectionToggle={onSortDirectionToggle}
            onSortKeyChange={onSortKeyChange}
            selectedSeasonValue={selectedSeasonValue}
            sortDirection={sortDirection}
            sortKey={sortKey}
          />
        </div>
      </details>

      <div className="hidden rounded-lg border border-asphalt-200 bg-white p-4 shadow-line md:block">
        <LeaderboardFilterFields
          data={data}
          draftFilters={draftFilters}
          onApply={onApply}
          onDraftFilterChange={onDraftFilterChange}
          onReset={onReset}
          onSortDirectionToggle={onSortDirectionToggle}
          onSortKeyChange={onSortKeyChange}
          selectedSeasonValue={selectedSeasonValue}
          sortDirection={sortDirection}
          sortKey={sortKey}
        />
      </div>
    </>
  );
}

function LeaderboardFilterFields({
  data,
  draftFilters,
  onApply,
  onDraftFilterChange,
  onReset,
  onSortDirectionToggle,
  onSortKeyChange,
  selectedSeasonValue,
  sortDirection,
  sortKey,
}: {
  data: LeaderboardResponse | null;
  draftFilters: DraftFilters;
  onApply: () => void;
  onDraftFilterChange: (key: keyof DraftFilters, value: string) => void;
  onReset: () => void;
  onSortDirectionToggle: () => void;
  onSortKeyChange: (sortKey: LeaderboardSortKey) => void;
  selectedSeasonValue: string;
  sortDirection: LeaderboardSortDirection;
  sortKey: LeaderboardSortKey;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <SelectField
          label="Saison"
          value={selectedSeasonValue}
          onChange={(value) => onDraftFilterChange("seasonId", value)}
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
          onChange={(value) => onDraftFilterChange("category", value)}
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
          onChange={(value) => onDraftFilterChange("source", value)}
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
          onChange={(value) => onDraftFilterChange("sportType", value)}
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
          onChange={(value) => onDraftFilterChange("from", value)}
        />
        <DateField
          label="Bis"
          value={draftFilters.to}
          onChange={(value) => onDraftFilterChange("to", value)}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <SelectField
          label="Sortierung"
          value={sortKey}
          onChange={(value) => onSortKeyChange(value as LeaderboardSortKey)}
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
          onClick={onSortDirectionToggle}
        >
          <ArrowDownUp aria-hidden className="h-4 w-4" />
          {sortDirection === "desc" ? "Absteigend" : "Aufsteigend"}
        </button>

        <button
          type="button"
          className="focus-ring mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
          onClick={onApply}
        >
          <Filter aria-hidden className="h-4 w-4" />
          Filter anwenden
        </button>

        <button
          type="button"
          className="focus-ring mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
          onClick={onReset}
        >
          <RotateCcw aria-hidden className="h-4 w-4" />
          Zurücksetzen
        </button>
      </div>
    </>
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
    <div className="hidden overflow-x-auto rounded-lg border border-asphalt-200 bg-white shadow-line md:block">
      <table className="min-w-[980px] w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-asphalt-50 text-xs uppercase text-asphalt-500">
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
              <td className="whitespace-nowrap px-4 py-4 font-semibold text-asphalt-900">
                <span className="inline-flex items-center gap-2">
                  {row.place <= 3 ? (
                    <Trophy aria-hidden className="h-4 w-4 text-signal-amber" />
                  ) : null}
                  {row.place}
                </span>
              </td>
              <td className="min-w-48 px-4 py-4 text-asphalt-900">
                <div>
                  <p className="font-medium">{row.displayName}</p>
                  <p className="mt-1 text-xs text-asphalt-500">
                    {row.seasonName}
                  </p>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-semibold text-asphalt-900">
                {formatNumber(row.totalPoints)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-asphalt-700">
                {formatNumber(row.totalRides)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-asphalt-700">
                {formatNumber(row.samstagsFahrten)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-asphalt-700">
                {formatNumber(row.mittwochsFahrten)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-asphalt-700">
                {formatNumber(row.sonderevents)}
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
    <th className="whitespace-nowrap px-4 py-3">
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
    <div className="overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line md:hidden">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_2.5rem] gap-2 border-b border-asphalt-100 bg-asphalt-50 px-3 py-2 text-xs font-semibold uppercase text-asphalt-500">
        <span>Platz</span>
        <span>Fahrer</span>
        <span className="text-right">Punkte</span>
        <span className="sr-only">Details</span>
      </div>
      {rows.map((row) => (
        <details
          key={`${row.seasonId}-${row.userId}`}
          className="group border-b border-asphalt-100 last:border-b-0"
        >
          <summary className="focus-ring grid min-h-14 cursor-pointer list-none grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_2.5rem] items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
            <span className="font-semibold text-asphalt-900">{row.place}</span>
            <span className="truncate font-medium text-asphalt-900">
              {row.displayName}
            </span>
            <span className="text-right font-semibold text-asphalt-900">
              {formatNumber(row.totalPoints)}
            </span>
            <span className="flex justify-end text-asphalt-500">
              <ChevronDown
                aria-hidden
                className="h-4 w-4 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>

          <div className="border-t border-asphalt-100 px-3 py-3">
            <p className="mb-3 text-xs text-asphalt-500">{row.seasonName}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Fahrten" value={row.totalRides} />
              <Metric label="Fondo" value={row.samstagsFahrten} />
              <Metric label="Mittwoch" value={row.mittwochsFahrten} />
              <Metric label="Sonderevents" value={row.sonderevents} />
            </div>
          </div>
        </details>
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
              Das Leaderboard ist für angemeldete Vereinsmitglieder sichtbar.
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
            Keine Einträge gefunden
          </h2>
          <p className="mt-1 leading-6">
            Für die aktuellen Filter gibt es keine gewerteten Aktivitäten.
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

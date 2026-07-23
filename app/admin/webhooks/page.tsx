import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCcw,
  RotateCcw,
} from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { addWebhookOwnerLabels } from "@/lib/admin/webhook-events";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type WebhookPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type WebhookEventRow = Database["public"]["Tables"]["webhook_events"]["Row"];
type WebhookEventDisplayRow = WebhookEventRow & { ownerLabel: string };
type WebhookConnectionRow = Pick<
  Database["public"]["Tables"]["strava_connections"]["Row"],
  "strava_athlete_id" | "user_id"
>;
type WebhookProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id"
>;

type WebhookFilters = {
  aspectType: (typeof ASPECT_TYPES)[number] | "all";
  from: string;
  objectType: (typeof OBJECT_TYPES)[number] | "all";
  ownerId: string;
  page: number;
  status: (typeof PROCESSING_STATUSES)[number] | "all";
  to: string;
};

type WebhookState =
  | {
      connections: WebhookConnectionRow[];
      count: number;
      events: WebhookEventDisplayRow[];
      filters: WebhookFilters;
      kind: "ready";
      profiles: WebhookProfileRow[];
    }
  | { kind: "error"; message: string };

const PAGE_SIZE = 50;
const PROCESSING_STATUSES = [
  "pending",
  "processing",
  "processed",
  "ignored",
  "failed",
] as const;
const OBJECT_TYPES = ["activity", "athlete"] as const;
const ASPECT_TYPES = ["create", "update", "delete"] as const;

export const dynamic = "force-dynamic";

export default async function AdminWebhooksPage({
  searchParams,
}: WebhookPageProps) {
  const params = searchParams ? await searchParams : {};
  const state = await loadWebhookState(params);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/admin"
          className="focus-ring mb-4 inline-flex min-h-9 items-center gap-2 rounded-md text-sm font-medium text-asphalt-700"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Zur Admin-Übersicht
        </Link>
        <PageHeader
          title="Webhook Events"
          description="Alle empfangenen Strava Webhook Events prüfen und nach Status, Art, Mitglied oder Zeitraum filtern."
        />
      </div>

      <AdminFlash
        error={getSingleParam(params.adminError)}
        status={getSingleParam(params.adminStatus)}
      />

      {state.kind === "error" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {state.message}
        </section>
      ) : (
        <>
          <WebhookFiltersPanel
            connections={state.connections}
            filters={state.filters}
            profiles={state.profiles}
          />
          <WebhookEventList
            count={state.count}
            events={state.events}
            filters={state.filters}
          />
        </>
      )}
    </main>
  );
}

function WebhookFiltersPanel({
  connections,
  filters,
  profiles,
}: {
  connections: WebhookConnectionRow[];
  filters: WebhookFilters;
  profiles: WebhookProfileRow[];
}) {
  const profileNames = new Map(
    profiles.map((profile) => [profile.id, profile.display_name]),
  );
  const owners = connections
    .map((connection) => ({
      id: String(connection.strava_athlete_id),
      label:
        profileNames.get(connection.user_id) ??
        `Athlete ID ${connection.strava_athlete_id}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "de"));

  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex items-center gap-2">
        <Filter aria-hidden className="h-5 w-5 text-signal-blue" />
        <h2 className="text-base font-semibold text-asphalt-900">Filter</h2>
      </div>
      <form className="mt-4 grid gap-4 md:grid-cols-5" method="get">
        <SelectField label="Status" name="status" value={filters.status}>
          <option value="all">Alle Status</option>
          {PROCESSING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Objektart"
          name="objectType"
          value={filters.objectType}
        >
          <option value="all">Alle Objektarten</option>
          {OBJECT_TYPES.map((objectType) => (
            <option key={objectType} value={objectType}>
              {objectType}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Ereignisart"
          name="aspectType"
          value={filters.aspectType}
        >
          <option value="all">Alle Ereignisarten</option>
          {ASPECT_TYPES.map((aspectType) => (
            <option key={aspectType} value={aspectType}>
              {aspectType}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Mitglied/Athlet"
          name="ownerId"
          value={filters.ownerId}
        >
          <option value="all">Alle Mitglieder</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.label}
            </option>
          ))}
        </SelectField>
        <div className="hidden md:block" />
        <InputField
          label="Empfangen von"
          name="from"
          type="date"
          value={filters.from}
        />
        <InputField
          label="Empfangen bis"
          name="to"
          type="date"
          value={filters.to}
        />
        <div className="flex flex-col gap-3 md:col-span-3 sm:flex-row sm:items-end">
          <button
            type="submit"
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
          >
            <Filter aria-hidden className="h-4 w-4" />
            Anwenden
          </button>
          <Link
            href="/admin/webhooks"
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            Zurücksetzen
          </Link>
        </div>
      </form>
    </section>
  );
}

function WebhookEventList({
  count,
  events,
  filters,
}: {
  count: number;
  events: WebhookEventDisplayRow[];
  filters: WebhookFilters;
}) {
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const firstResult = count === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastResult = Math.min(filters.page * PAGE_SIZE, count);
  const hasFailedEvents = events.some(
    (event) => event.processing_status === "failed",
  );

  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-asphalt-900">
            Gefundene Events
          </h2>
          <p className="mt-1 text-sm text-asphalt-600">
            {firstResult}–{lastResult} von {count}
          </p>
        </div>
        {hasFailedEvents ? (
          <form action="/api/admin/webhooks/retry-failed" method="post">
            <button
              type="submit"
              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
            >
              <RefreshCcw aria-hidden className="h-4 w-4" />
              Fehlgeschlagene erneut verarbeiten
            </button>
          </form>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-asphalt-600">
          Keine Webhook Events für die gewählten Filter gefunden.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-asphalt-100">
          {events.map((event) => (
            <li key={event.id} className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-asphalt-900">
                    {event.object_type}/{event.aspect_type} #{event.object_id}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-asphalt-500">
                    {event.ownerLabel} · empfangen{" "}
                    {formatDateTime(event.created_at)} · Event-Zeit{" "}
                    {formatDateTime(event.event_time)}
                  </p>
                  {event.processing_error ? (
                    <p className="mt-2 break-words text-sm leading-6 text-red-700">
                      {event.processing_error}
                    </p>
                  ) : null}
                  {event.processing_status === "failed" ? (
                    <form
                      action="/api/admin/webhooks/ignore"
                      method="post"
                      className="mt-3"
                    >
                      <input type="hidden" name="eventId" value={event.id} />
                      <button
                        type="submit"
                        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-red-300 px-3 text-xs font-medium text-red-800"
                      >
                        Event ignorieren
                      </button>
                    </form>
                  ) : null}
                </div>
                <StatusBadge tone={webhookTone(event.processing_status)}>
                  {event.processing_status}
                </StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      )}

      {count > PAGE_SIZE ? (
        <nav
          aria-label="Seitennavigation"
          className="mt-5 flex items-center justify-between border-t border-asphalt-100 pt-4"
        >
          {filters.page > 1 ? (
            <Link
              href={buildPageHref(filters, filters.page - 1)}
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
              Zurück
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-asphalt-600">
            Seite {filters.page} von {pageCount}
          </span>
          {filters.page < pageCount ? (
            <Link
              href={buildPageHref(filters, filters.page + 1)}
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
            >
              Weiter
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function SelectField({
  children,
  label,
  name,
  value,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <select
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={value}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

function InputField({
  label,
  name,
  type,
  value,
}: {
  label: string;
  name: string;
  type: "date";
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={value}
        name={name}
        type={type}
      />
    </label>
  );
}

async function loadWebhookState(
  params: Record<string, string | string[] | undefined>,
): Promise<WebhookState> {
  const filters = parseFilters(params);

  try {
    const supabase = createSupabaseServiceRoleClient();
    let eventsQuery = supabase
      .from("webhook_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.status !== "all") {
      eventsQuery = eventsQuery.eq("processing_status", filters.status);
    }
    if (filters.objectType !== "all") {
      eventsQuery = eventsQuery.eq("object_type", filters.objectType);
    }
    if (filters.aspectType !== "all") {
      eventsQuery = eventsQuery.eq("aspect_type", filters.aspectType);
    }
    if (filters.ownerId !== "all") {
      eventsQuery = eventsQuery.eq("owner_id", Number(filters.ownerId));
    }
    if (filters.from) {
      eventsQuery = eventsQuery.gte(
        "created_at",
        berlinDateBoundary(filters.from),
      );
    }
    if (filters.to) {
      eventsQuery = eventsQuery.lt(
        "created_at",
        berlinDateBoundary(addDays(filters.to, 1)),
      );
    }

    const from = (filters.page - 1) * PAGE_SIZE;
    const [eventsResult, connectionsResult] = await Promise.all([
      eventsQuery.range(from, from + PAGE_SIZE - 1),
      supabase
        .from("strava_connections")
        .select("user_id, strava_athlete_id")
        .order("strava_athlete_id"),
    ]);

    if (eventsResult.error) {
      throw eventsResult.error;
    }
    if (connectionsResult.error) {
      throw connectionsResult.error;
    }

    const connections = (connectionsResult.data ??
      []) as WebhookConnectionRow[];
    const profileIds = [
      ...new Set(connections.map((connection) => connection.user_id)),
    ];
    const profilesResult =
      profileIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", profileIds)
        : { data: [], error: null };

    if (profilesResult.error) {
      throw profilesResult.error;
    }

    const profiles = (profilesResult.data ?? []) as WebhookProfileRow[];
    const events = (eventsResult.data ?? []) as WebhookEventRow[];

    return {
      connections,
      count: eventsResult.count ?? 0,
      events: addWebhookOwnerLabels(events, connections, profiles),
      filters,
      kind: "ready",
      profiles,
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Webhook Events konnten nicht geladen werden.",
    };
  }
}

function parseFilters(
  params: Record<string, string | string[] | undefined>,
): WebhookFilters {
  const status = getSingleParam(params.status) ?? "all";
  const objectType = getSingleParam(params.objectType) ?? "all";
  const aspectType = getSingleParam(params.aspectType) ?? "all";
  const ownerId = getSingleParam(params.ownerId) ?? "all";
  const page = Number.parseInt(getSingleParam(params.page) ?? "1", 10);

  return {
    aspectType: isAllowed(aspectType, ASPECT_TYPES) ? aspectType : "all",
    from: parseDate(getSingleParam(params.from)),
    objectType: isAllowed(objectType, OBJECT_TYPES) ? objectType : "all",
    ownerId: /^\d+$/.test(ownerId) ? ownerId : "all",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    status: isAllowed(status, PROCESSING_STATUSES) ? status : "all",
    to: parseDate(getSingleParam(params.to)),
  };
}

function buildPageHref(filters: WebhookFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.objectType !== "all")
    params.set("objectType", filters.objectType);
  if (filters.aspectType !== "all")
    params.set("aspectType", filters.aspectType);
  if (filters.ownerId !== "all") params.set("ownerId", filters.ownerId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/webhooks?${query}` : "/admin/webhooks";
}

function isAllowed<const Value extends string>(
  value: string,
  allowed: readonly Value[],
): value is Value | "all" {
  return value === "all" || allowed.includes(value as Value);
}

function parseDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? ""
    : value;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function berlinDateBoundary(value: string) {
  const localAsUtc = new Date(`${value}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Berlin",
    year: "numeric",
  }).formatToParts(localAsUtc);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour) % 24,
    Number(values.minute),
    Number(values.second),
  );
  const offset = representedAsUtc - localAsUtc.getTime();

  return new Date(localAsUtc.getTime() - offset).toISOString();
}

function webhookTone(status: WebhookEventRow["processing_status"]) {
  switch (status) {
    case "processed":
      return "success";
    case "failed":
      return "danger";
    case "ignored":
      return "warning";
    case "pending":
    case "processing":
      return "info";
  }
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

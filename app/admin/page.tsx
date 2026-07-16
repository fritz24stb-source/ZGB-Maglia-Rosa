import { Bell, CheckCircle2, Clock, LogOut, RefreshCcw } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { AdminSectionGrid } from "@/components/admin-section-grid";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  addWebhookOwnerLabels,
  dedupeWebhookEventsForDisplay,
} from "@/lib/admin/webhook-events";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type NotificationRow =
  Database["public"]["Tables"]["admin_notifications"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];
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

type DashboardState =
  | {
      kind: "ready";
      activeMembers: number;
      failedWebhookEventCount: number;
      failedWebhookEvents: WebhookEventDisplayRow[];
      notifications: NotificationRow[];
      pendingWebhookEvents: number;
      seasons: SeasonRow[];
      unreadNotifications: number;
      webhookEvents: WebhookEventDisplayRow[];
    }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = searchParams ? await searchParams : {};
  const state = await loadDashboardState();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Admin"
          description="Zentrale Verwaltung für Saisons, Regeln, Mitglieder, Sync und Export."
        />
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Abmelden
          </button>
        </form>
      </div>
      <AdminFlash
        error={getSingleParam(params.adminError)}
        status={getSingleParam(params.adminStatus)}
      />

      {state.kind === "error" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {state.message}
        </section>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <AdminSectionGrid
            activeMembers={state.activeMembers}
            failedWebhookEvents={state.failedWebhookEventCount}
            pendingWebhookEvents={state.pendingWebhookEvents}
            unreadNotifications={state.unreadNotifications}
          />

          <FailedWebhookEventsPanel events={state.failedWebhookEvents} />

          <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <RefreshCcw
                    aria-hidden
                    className="h-5 w-5 text-signal-blue"
                  />
                  <h2 className="text-base font-semibold text-asphalt-900">
                    Resync für aktive Mitglieder
                  </h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-asphalt-600">
                  Lädt Strava-Aktivitäten im gewählten Saisonfenster nach und
                  bewertet sie neu.
                </p>
              </div>
              <form
                action="/api/admin/sync/all"
                method="post"
                className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-72"
              >
                <select
                  className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                  name="seasonId"
                  defaultValue={
                    state.seasons.find((season) => season.is_active)?.id ??
                    "all"
                  }
                >
                  <option value="all">Alle Saisons</option>
                  {state.seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                      {season.is_active ? " (aktiv)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
                >
                  <RefreshCcw aria-hidden className="h-4 w-4" />
                  Resync starten
                </button>
              </form>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <NotificationsPanel notifications={state.notifications} />
            <WebhookPanel events={state.webhookEvents} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function FailedWebhookEventsPanel({
  events,
}: {
  events: WebhookEventDisplayRow[];
}) {
  return (
    <section
      id="failed-webhook-events"
      className="scroll-mt-6 rounded-lg border border-red-200 bg-red-50 p-5 shadow-line"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-asphalt-900">
            Fehlgeschlagene Webhook Events
          </h2>
          <p className="mt-1 text-sm leading-6 text-asphalt-600">
            Nach Behebung der Ursache erneut verarbeiten. Erfolgreich
            verarbeitete Events verschwinden anschliessend aus dieser Anzeige.
          </p>
        </div>
        {events.length > 0 ? (
          <form action="/api/admin/webhooks/retry-failed" method="post">
            <button
              type="submit"
              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
            >
              <RefreshCcw aria-hidden className="h-4 w-4" />
              Erneut verarbeiten
            </button>
          </form>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-asphalt-600">
          Keine fehlgeschlagenen Webhook Events. Der Sync-Status ist bereinigt.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-red-200">
          {events.map((event) => (
            <li key={event.id} className="py-3">
              <p className="text-sm font-medium text-asphalt-900">
                {event.object_type}/{event.aspect_type} #{event.object_id}
              </p>
              <p className="mt-1 text-xs text-asphalt-600">
                {event.ownerLabel} - {formatDateTime(event.created_at)}
              </p>
              <p className="mt-1 text-sm leading-6 text-red-800">
                {event.processing_error ?? "Unbekannte Fehlerursache."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationsPanel({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell aria-hidden className="h-5 w-5 text-signal-amber" />
          <h2 className="text-base font-semibold text-asphalt-900">
            Admin Notifications
          </h2>
        </div>
        {notifications.length > 0 ? (
          <form action="/api/admin/notifications/read-all" method="post">
            <button
              type="submit"
              className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border border-asphalt-300 px-3 text-xs font-medium text-asphalt-800"
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              Alle gelesen
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-asphalt-600">
          Keine ungelesenen Benachrichtigungen.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-asphalt-100">
          {notifications.map((notification) => (
            <li key={notification.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-asphalt-900">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-asphalt-600">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-asphalt-500">
                    {formatDateTime(notification.created_at)}
                  </p>
                </div>
                <form
                  action={`/api/admin/notifications/${notification.id}/read`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-asphalt-300 text-asphalt-800"
                    aria-label="Benachrichtigung als gelesen markieren"
                  >
                    <CheckCircle2 aria-hidden className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WebhookPanel({ events }: { events: WebhookEventDisplayRow[] }) {
  return (
    <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
      <div className="flex items-center gap-2">
        <Clock aria-hidden className="h-5 w-5 text-signal-blue" />
        <h2 className="text-base font-semibold text-asphalt-900">
          Letzte Webhook Events
        </h2>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-asphalt-600">
          Noch keine Webhook Events gespeichert.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-asphalt-100">
          {events.map((event) => (
            <li key={event.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-asphalt-900">
                    {event.object_type}/{event.aspect_type} #{event.object_id}
                  </p>
                  <p className="mt-1 text-xs text-asphalt-500">
                    {event.ownerLabel} - {formatDateTime(event.created_at)}
                  </p>
                  {event.processing_error ? (
                    <p className="mt-1 text-xs text-red-700">
                      {event.processing_error}
                    </p>
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
    </section>
  );
}

async function loadDashboardState(): Promise<DashboardState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const [
      seasonsResult,
      notificationsResult,
      webhookEventsResult,
      failedWebhookEventDetailsResult,
      unreadNotificationsResult,
      pendingWebhookEventsResult,
      failedWebhookEventsResult,
      activeMembersResult,
    ] = await Promise.all([
      supabase
        .from("seasons")
        .select("*")
        .order("starts_on", { ascending: false }),
      supabase
        .from("admin_notifications")
        .select("*")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(24),
      supabase
        .from("webhook_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("webhook_events")
        .select("*")
        .eq("processing_status", "failed")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("admin_notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
      supabase
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "pending"),
      supabase
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "failed"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    const firstError =
      seasonsResult.error ??
      notificationsResult.error ??
      webhookEventsResult.error ??
      failedWebhookEventDetailsResult.error ??
      unreadNotificationsResult.error ??
      pendingWebhookEventsResult.error ??
      failedWebhookEventsResult.error ??
      activeMembersResult.error;

    if (firstError) {
      throw firstError;
    }

    const webhookEvents = dedupeWebhookEventsForDisplay(
      (webhookEventsResult.data ?? []) as WebhookEventRow[],
      8,
    );
    const failedWebhookEvents =
      (failedWebhookEventDetailsResult.data ?? []) as WebhookEventRow[];
    const eventsWithOwners = [...webhookEvents, ...failedWebhookEvents];
    const webhookConnections = await loadWebhookConnections(
      supabase,
      eventsWithOwners,
    );
    const webhookProfiles = await loadWebhookProfiles(
      supabase,
      webhookConnections,
    );

    return {
      kind: "ready",
      activeMembers: activeMembersResult.count ?? 0,
      failedWebhookEventCount: failedWebhookEventsResult.count ?? 0,
      failedWebhookEvents: addWebhookOwnerLabels(
        failedWebhookEvents,
        webhookConnections,
        webhookProfiles,
      ),
      notifications: (notificationsResult.data ?? []) as NotificationRow[],
      pendingWebhookEvents: pendingWebhookEventsResult.count ?? 0,
      seasons: (seasonsResult.data ?? []) as SeasonRow[],
      unreadNotifications: unreadNotificationsResult.count ?? 0,
      webhookEvents: addWebhookOwnerLabels(
        webhookEvents,
        webhookConnections,
        webhookProfiles,
      ),
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Admin-Dashboard konnte nicht geladen werden.",
    };
  }
}

async function loadWebhookConnections(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  events: WebhookEventRow[],
) {
  const ownerIds = [...new Set(events.map((event) => event.owner_id))];

  if (ownerIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("strava_connections")
    .select("user_id, strava_athlete_id")
    .in("strava_athlete_id", ownerIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as WebhookConnectionRow[];
}

async function loadWebhookProfiles(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  connections: WebhookConnectionRow[],
) {
  const profileIds = [...new Set(connections.map((entry) => entry.user_id))];

  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", profileIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as WebhookProfileRow[];
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

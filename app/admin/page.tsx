import { Bell, CheckCircle2, Clock, LogOut, RefreshCcw } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { AdminSectionGrid } from "@/components/admin-section-grid";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type NotificationRow =
  Database["public"]["Tables"]["admin_notifications"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];
type WebhookEventRow = Database["public"]["Tables"]["webhook_events"]["Row"];

type DashboardState =
  | {
      kind: "ready";
      activeActivities: number;
      activeMembers: number;
      failedWebhookEvents: number;
      notifications: NotificationRow[];
      pendingWebhookEvents: number;
      seasons: SeasonRow[];
      unreadNotifications: number;
      webhookEvents: WebhookEventRow[];
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
        <form action="/api/admin/logout" method="post">
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
            activeActivities={state.activeActivities}
            activeMembers={state.activeMembers}
            failedWebhookEvents={state.failedWebhookEvents}
            pendingWebhookEvents={state.pendingWebhookEvents}
            unreadNotifications={state.unreadNotifications}
          />

          <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <RefreshCcw
                    aria-hidden
                    className="h-5 w-5 text-signal-blue"
                  />
                  <h2 className="text-base font-semibold text-asphalt-900">
                    Resync fuer aktive Mitglieder
                  </h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-asphalt-600">
                  Laedt Strava-Aktivitaeten im gewaehlten Saisonfenster nach und
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

function WebhookPanel({ events }: { events: WebhookEventRow[] }) {
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
                    Athlete {event.owner_id} -{" "}
                    {formatDateTime(event.created_at)}
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
      unreadNotificationsResult,
      pendingWebhookEventsResult,
      failedWebhookEventsResult,
      activeMembersResult,
      activeActivitiesResult,
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
        .limit(8),
      supabase
        .from("webhook_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
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
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

    const firstError =
      seasonsResult.error ??
      notificationsResult.error ??
      webhookEventsResult.error ??
      unreadNotificationsResult.error ??
      pendingWebhookEventsResult.error ??
      failedWebhookEventsResult.error ??
      activeMembersResult.error ??
      activeActivitiesResult.error;

    if (firstError) {
      throw firstError;
    }

    return {
      kind: "ready",
      activeActivities: activeActivitiesResult.count ?? 0,
      activeMembers: activeMembersResult.count ?? 0,
      failedWebhookEvents: failedWebhookEventsResult.count ?? 0,
      notifications: (notificationsResult.data ?? []) as NotificationRow[],
      pendingWebhookEvents: pendingWebhookEventsResult.count ?? 0,
      seasons: (seasonsResult.data ?? []) as SeasonRow[],
      unreadNotifications: unreadNotificationsResult.count ?? 0,
      webhookEvents: (webhookEventsResult.data ?? []) as WebhookEventRow[],
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

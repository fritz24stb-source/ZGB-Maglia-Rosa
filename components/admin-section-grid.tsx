import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Download,
  ListChecks,
  RefreshCcw,
  Route,
  Ticket,
  Users,
} from "lucide-react";
import { adminSections } from "@/lib/navigation";

type AdminSectionGridProps = {
  activeMembers?: number;
  failedWebhookEvents?: number;
  pendingWebhookEvents?: number;
  unreadNotifications?: number;
};

const iconByHref = {
  "/admin/seasons": CalendarDays,
  "/admin/rules": ListChecks,
  "/admin/members": Users,
  "/admin/invitations": Ticket,
  "/admin/activities": Route,
  "/admin/export": Download,
} satisfies Record<string, React.ComponentType<{ className?: string }>>;

export function AdminSectionGrid({
  activeMembers = 0,
  failedWebhookEvents = 0,
  pendingWebhookEvents = 0,
  unreadNotifications = 0,
}: AdminSectionGridProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex items-center gap-2 text-asphalt-900">
          <Bell aria-hidden className="h-5 w-5 text-signal-amber" />
          <h2 className="text-base font-semibold">Offene Hinweise</h2>
        </div>
        <p className="mt-3 text-2xl font-semibold text-asphalt-900">
          {unreadNotifications}
        </p>
        <p className="mt-1 text-sm text-asphalt-600">
          ungelesene Admin-Notifications.
        </p>
      </article>
      <Link
        href="/admin?showFailedWebhookEvents=1#failed-webhook-events"
        className="focus-ring rounded-lg border border-asphalt-200 bg-white p-5 shadow-line transition hover:border-asphalt-400"
        aria-label="Fehlgeschlagene Webhook Events anzeigen"
      >
        <div className="flex items-center gap-2 text-asphalt-900">
          <RefreshCcw aria-hidden className="h-5 w-5 text-signal-blue" />
          <h2 className="text-base font-semibold">Sync Status</h2>
        </div>
        <p className="mt-3 text-2xl font-semibold text-asphalt-900">
          {pendingWebhookEvents}/{failedWebhookEvents}
        </p>
        <p className="mt-1 text-sm text-asphalt-600">
          pending/failed Webhook Events.
        </p>
      </Link>
      <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex items-center gap-2 text-asphalt-900">
          <Users aria-hidden className="h-5 w-5 text-signal-blue" />
          <h2 className="text-base font-semibold">Aktive Daten</h2>
        </div>
        <p className="mt-3 text-2xl font-semibold text-asphalt-900">
          {activeMembers}
        </p>
        <p className="mt-1 text-sm text-asphalt-600">aktive Mitglieder.</p>
      </article>
      {adminSections.map((section) => {
        const Icon = iconByHref[section.href];

        return (
          <Link
            key={section.href}
            href={section.href}
            className="focus-ring rounded-lg border border-asphalt-200 bg-white p-5 shadow-line transition hover:border-asphalt-400"
          >
            <div className="flex items-center gap-2 text-asphalt-900">
              <Icon aria-hidden className="h-5 w-5 text-signal-blue" />
              <h2 className="text-base font-semibold">{section.label}</h2>
            </div>
            <p className="mt-3 text-sm text-asphalt-600">
              {section.description}
            </p>
          </Link>
        );
      })}
    </section>
  );
}

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Download,
  ListChecks,
  RefreshCcw,
  Route,
  Users,
} from "lucide-react";
import { adminSections } from "@/lib/navigation";

const iconByHref = {
  "/admin/seasons": CalendarDays,
  "/admin/rules": ListChecks,
  "/admin/members": Users,
  "/admin/activities": Route,
  "/admin/export": Download,
} satisfies Record<string, React.ComponentType<{ className?: string }>>;

export function AdminSectionGrid() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex items-center gap-2 text-asphalt-900">
          <Bell aria-hidden className="h-5 w-5 text-signal-amber" />
          <h2 className="text-base font-semibold">Offene Hinweise</h2>
        </div>
        <p className="mt-3 text-sm text-asphalt-600">
          Admin-Notifications werden in der Datenbankphase angebunden.
        </p>
      </article>
      <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex items-center gap-2 text-asphalt-900">
          <RefreshCcw aria-hidden className="h-5 w-5 text-signal-blue" />
          <h2 className="text-base font-semibold">Sync Status</h2>
        </div>
        <p className="mt-3 text-sm text-asphalt-600">
          Webhook- und Fallback-Sync erhalten eigene Admin-Aktionen.
        </p>
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

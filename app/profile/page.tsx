import { Activity, Link2Off } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Profil"
        description="Eigener Verbindungsstatus und letzte Aktivitäten."
      />
      <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
          <h2 className="text-base font-semibold text-asphalt-900">
            Strava-Verbindung
          </h2>
          <div className="mt-4 flex items-center justify-between gap-3">
            <StatusBadge tone="neutral">Nicht verbunden</StatusBadge>
            <button
              type="button"
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800 disabled:opacity-60"
              disabled
            >
              <Link2Off aria-hidden className="h-4 w-4" />
              Trennen
            </button>
          </div>
        </article>
        <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
          <div className="flex items-center gap-2">
            <Activity aria-hidden className="h-5 w-5 text-signal-blue" />
            <h2 className="text-base font-semibold text-asphalt-900">
              Letzte Aktivitäten
            </h2>
          </div>
          <p className="mt-4 text-sm text-asphalt-600">
            Sobald Sync und Datenmodell umgesetzt sind, erscheinen hier die
            eigenen gewerteten Aktivitäten.
          </p>
        </article>
      </section>
    </main>
  );
}

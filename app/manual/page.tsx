import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";

export default function ManualEntryPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Manuelle Eingabe"
        description="Backup-Erfassung mit serverseitig geprüften Zeitfenstern und Duplicate-Limits."
      />
      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck
                aria-hidden
                className="h-5 w-5 text-signal-blue"
              />
              <h2 className="text-base font-semibold text-asphalt-900">
                Aktuelles Eingabefenster
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-asphalt-600">
              Die konkrete Fensterberechnung wird in der Backend-Phase zentral
              implementiert. Die UI ist für offene, geschlossene und abgelaufene
              Saison-Zustände vorbereitet.
            </p>
          </div>
          <StatusBadge tone="warning">Noch nicht aktiv</StatusBadge>
        </div>
      </section>
    </main>
  );
}

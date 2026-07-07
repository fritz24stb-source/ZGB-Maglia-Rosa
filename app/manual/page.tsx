import { ClipboardCheck } from "lucide-react";
import { ManualEntryPanel } from "@/components/manual-entry-panel";
import { PageHeader } from "@/components/page-header";
import { requireActiveAppPage } from "@/lib/auth/page-guard";

export const dynamic = "force-dynamic";

export default async function ManualEntryPage() {
  const accessBlocked = await requireActiveAppPage("/manual");

  if (accessBlocked) {
    return accessBlocked;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Manuelle Eingabe"
        description="Erfassung mit Namenszuordnung, serverseitig geprüften Zeitfenstern, Duplicate-Schutz und direkter Punktevergabe."
      />
      <section className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
        <div className="flex items-start gap-3">
          <ClipboardCheck
            aria-hidden
            className="mt-0.5 h-5 w-5 text-signal-blue"
          />
          <p className="text-sm leading-6 text-asphalt-600">
            Manuelle Einträge werden dem angegebenen Namen zugeordnet. Falls
            noch kein Profil existiert, wird automatisch ein Mitgliedsprofil für
            das Ranking angelegt.
          </p>
        </div>
      </section>
      <ManualEntryPanel />
    </main>
  );
}

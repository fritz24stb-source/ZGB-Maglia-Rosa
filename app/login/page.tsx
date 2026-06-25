import { Bike, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Anmelden"
        description="Mitglieder verbinden ihr Konto einmalig über Strava. Access Tokens bleiben serverseitig."
      />
      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-asphalt-900 p-2 text-white">
              <Bike aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-asphalt-900">
                Strava OAuth vorbereiten
              </h2>
              <p className="mt-1 text-sm leading-6 text-asphalt-600">
                Der Button wird in der OAuth-Phase mit
                <code className="mx-1 rounded bg-asphalt-100 px-1 py-0.5 text-xs">
                  /api/strava/connect
                </code>
                verbunden.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#fc4c02] px-4 text-sm font-semibold text-white shadow-line disabled:cursor-not-allowed disabled:opacity-60"
            disabled
          >
            <ShieldCheck aria-hidden className="h-4 w-4" />
            Mit Strava verbinden
          </button>
        </div>
      </section>
    </main>
  );
}

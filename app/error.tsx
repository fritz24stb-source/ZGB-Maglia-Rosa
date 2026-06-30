"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900 shadow-line">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5" />
            <div>
              <h1 className="text-base font-semibold">
                Seite konnte nicht geladen werden
              </h1>
              <p className="mt-1 text-sm leading-6">
                Der Fehler wurde serverseitig erfasst. Bitte erneut laden.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-300 px-3 text-sm font-medium"
            onClick={reset}
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            Erneut laden
          </button>
        </div>
      </section>
    </main>
  );
}

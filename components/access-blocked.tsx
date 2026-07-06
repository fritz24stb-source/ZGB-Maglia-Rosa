import { AlertTriangle } from "lucide-react";

export function AccessBlocked() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
        <div className="flex gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5" />
          <div>
            <h1 className="text-base font-semibold">Profil gesperrt</h1>
            <p className="mt-1 text-sm leading-6">
              Dieses Profil ist aktuell nicht fuer die App freigegeben.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

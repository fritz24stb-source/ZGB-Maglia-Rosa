import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">
        <div className="flex items-center gap-2">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Adminbereich wird geladen.
        </div>
      </section>
    </main>
  );
}

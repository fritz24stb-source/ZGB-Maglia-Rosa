import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <SearchX aria-hidden className="mt-0.5 h-5 w-5 text-signal-blue" />
            <div>
              <h1 className="text-base font-semibold text-asphalt-900">
                Seite nicht gefunden
              </h1>
              <p className="mt-1 text-sm leading-6 text-asphalt-600">
                Die angeforderte Seite existiert nicht oder wurde verschoben.
              </p>
            </div>
          </div>
          <Link
            href="/leaderboard"
            className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
          >
            Zum Leaderboard
          </Link>
        </div>
      </section>
    </main>
  );
}

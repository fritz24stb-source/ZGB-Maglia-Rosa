import { PageHeader } from "@/components/page-header";

const SKELETON_ROW_COUNT = 8;

export default function LeaderboardLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Leaderboard"
        description="Auswertung mit Saison-, Quellen- und Kategorie-Filtern."
      />

      <section
        className="flex flex-col gap-4"
        aria-label="Leaderboard wird geladen"
        aria-busy="true"
      >
        <div className="h-12 rounded-lg border border-asphalt-200 bg-white shadow-line md:hidden" />

        <div className="hidden rounded-lg border border-asphalt-200 bg-white p-4 shadow-line md:block">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonField key={index} />
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <SkeletonField />
            <div className="mt-auto h-10 rounded-md bg-asphalt-100" />
            <div className="mt-auto h-10 w-32 rounded-md bg-asphalt-200" />
            <div className="mt-auto h-10 w-28 rounded-md bg-asphalt-100" />
          </div>
        </div>

        <div className="h-6" />

        <div className="min-h-[50vh]">
          <div className="hidden overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line md:block">
            <div className="h-10 border-b border-asphalt-100 bg-asphalt-50" />
            <div className="divide-y divide-asphalt-100">
              {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                <div
                  key={index}
                  className="grid h-14 animate-pulse grid-cols-[7rem_1fr_repeat(5,7rem)] items-center gap-4 px-4"
                >
                  <span className="h-4 rounded bg-asphalt-100" />
                  <span className="h-4 max-w-48 rounded bg-asphalt-100" />
                  {Array.from({ length: 5 }, (_, metricIndex) => (
                    <span
                      key={metricIndex}
                      className="h-4 rounded bg-asphalt-100"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line md:hidden">
            <div className="h-10 border-b border-asphalt-100 bg-asphalt-50" />
            <div className="divide-y divide-asphalt-100">
              {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                <div
                  key={index}
                  className="grid h-14 animate-pulse grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_2.5rem] items-center gap-2 px-3"
                >
                  <span className="h-4 rounded bg-asphalt-100" />
                  <span className="h-4 rounded bg-asphalt-100" />
                  <span className="h-4 rounded bg-asphalt-100" />
                  <span className="ml-auto h-4 w-4 rounded bg-asphalt-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SkeletonField() {
  return (
    <div className="animate-pulse">
      <div className="mb-1 h-5 w-16 rounded bg-asphalt-100" />
      <div className="h-10 rounded-md bg-asphalt-100" />
    </div>
  );
}

import { LeaderboardPreview } from "@/components/leaderboard-preview";
import { PageHeader } from "@/components/page-header";
import { requireActiveAppPage } from "@/lib/auth/page-guard";
import { loadLeaderboardResponse } from "@/lib/leaderboard/server";

export const dynamic = "force-dynamic";

type LeaderboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const accessBlocked = await requireActiveAppPage("/leaderboard");

  if (accessBlocked) {
    return accessBlocked;
  }

  const initialData = await loadLeaderboardResponse(
    toUrlSearchParams(await searchParams),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Leaderboard"
        description="Auswertung mit Saison-, Quellen- und Kategorie-Filtern."
      />
      <LeaderboardPreview initialData={initialData} />
    </main>
  );
}

function toUrlSearchParams(
  values: Record<string, string | string[] | undefined>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

import { LeaderboardPreview } from "@/components/leaderboard-preview";
import { PageHeader } from "@/components/page-header";

export default function LeaderboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Leaderboard"
        description="Mobile-first Auswertung mit Saison-, Quellen- und Kategorie-Filtern."
      />
      <LeaderboardPreview />
    </main>
  );
}

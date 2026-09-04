import { LeaderboardPreview } from "@/components/leaderboard-preview";
import {
  ClassificationLeaderboard,
  ClassificationTabs,
} from "@/components/classification-leaderboards";
import { PageHeader } from "@/components/page-header";
import { requireActiveAppPage } from "@/lib/auth/page-guard";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";
import { loadLeaderboardResponse } from "@/lib/leaderboard/server";
import {
  canAccessAzzurra,
  canAccessCiclamino,
} from "@/lib/classifications/access";
import { loadClassificationLeaderboard } from "@/lib/classifications/server";
import type { ClassificationKind } from "@/lib/classifications/types";

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

  const access = await loadCurrentAppAccessState();
  const resolvedParams = await searchParams;
  const urlParams = toUrlSearchParams(resolvedParams);
  const ciclaminoEnabled =
    access.kind === "active" && canAccessCiclamino(access.profile.role);
  const azzurraEnabled =
    access.kind === "active" && canAccessAzzurra(access.profile.role);
  const requestedClassification = single(resolvedParams.classification);
  const classification: ClassificationKind =
    requestedClassification === "ciclamino" && ciclaminoEnabled
      ? "ciclamino"
      : requestedClassification === "azzurra" && azzurraEnabled
        ? "azzurra"
        : "rosa";
  const initialData = await loadLeaderboardResponse(urlParams);
  const classificationData =
    classification !== "rosa"
      ? await loadClassificationLeaderboard(single(resolvedParams.seasonId), {
          includeAzzurra: classification === "azzurra",
          includeCiclamino: classification === "ciclamino",
        })
      : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Leaderboard"
        description={leaderboardDescription(ciclaminoEnabled, azzurraEnabled)}
      />
      <ClassificationTabs
        active={classification}
        azzurraEnabled={azzurraEnabled}
        ciclaminoEnabled={ciclaminoEnabled}
        seasonId={
          classificationData?.selectedSeasonId ?? initialData.filters.seasonId
        }
      />
      {classification === "rosa" || !classificationData ? (
        <LeaderboardPreview initialData={initialData} />
      ) : (
        <ClassificationLeaderboard
          active={classification}
          data={classificationData}
        />
      )}
    </main>
  );
}

function leaderboardDescription(
  ciclaminoEnabled: boolean,
  azzurraEnabled: boolean,
) {
  const classifications = [
    "Maglia Rosa",
    ...(ciclaminoEnabled ? ["Ciclamino"] : []),
    ...(azzurraEnabled ? ["Azzurra"] : []),
  ];

  return `${classifications.join(", ").replace(/, ([^,]+)$/, " und $1")} im Saisonvergleich.`;
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

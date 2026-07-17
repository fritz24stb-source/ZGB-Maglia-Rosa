export type UserSyncSummary = {
  activitiesFetched: number;
  apiRequests: number;
  completionStatus:
    | "completed"
    | "partial_rate_budget"
    | "partial_page_limit"
    | "no_active_season";
  failed: number;
  skipped: number;
  synced: number;
  users: number;
};

export function formatUserSyncSummary(summary: UserSyncSummary) {
  return [
    `${summary.users} User`,
    `${summary.synced} synchronisiert`,
    `${summary.activitiesFetched} von Strava geladen`,
    `${summary.apiRequests} API-Anfragen`,
    `${summary.skipped} übersprungen`,
    `${summary.failed} fehlgeschlagen`,
    formatCompletionStatus(summary.completionStatus),
  ].join(", ");
}

export function isCompletedSync(summary: UserSyncSummary) {
  return summary.completionStatus === "completed";
}

function formatCompletionStatus(status: UserSyncSummary["completionStatus"]) {
  switch (status) {
    case "completed":
      return "vollständig abgeschlossen";
    case "partial_rate_budget":
      return "unvollständig: API-Reserve erreicht";
    case "partial_page_limit":
      return "unvollständig: Seitenlimit erreicht";
    case "no_active_season":
      return "nicht gestartet: keine aktive Saison";
  }
}

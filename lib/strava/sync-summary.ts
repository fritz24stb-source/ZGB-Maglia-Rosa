export type UserSyncSummary = {
  activitiesFetched: number;
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
    `${summary.skipped} übersprungen`,
    `${summary.failed} fehlgeschlagen`,
  ].join(", ");
}

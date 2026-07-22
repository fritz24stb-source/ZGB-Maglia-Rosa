import { parseStravaScopes } from "@/lib/strava/oauth";

type ExistingStravaConnection = {
  revoked: boolean;
  scope: string | null;
  user_id: string;
};

export function shouldRunAutomaticUserResync(
  existingConnection: ExistingStravaConnection | null,
) {
  if (existingConnection === null) {
    return true;
  }

  if (existingConnection.revoked) {
    return false;
  }

  return !parseStravaScopes(existingConnection.scope).has("activity:read_all");
}

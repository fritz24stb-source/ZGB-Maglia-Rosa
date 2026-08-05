import "server-only";

export type StravaRuntimeMode = "production" | "local-readonly" | "simulated";

export function getStravaRuntimeMode(): StravaRuntimeMode {
  const value = process.env.STRAVA_RUNTIME_MODE;
  if (value === "local-readonly" || value === "simulated" || value === "production") {
    return value;
  }
  return process.env.NODE_ENV === "production" ? "production" : "local-readonly";
}

export function stravaTokenRefreshEnabled() {
  return flag("STRAVA_TOKEN_REFRESH_ENABLED", getStravaRuntimeMode() === "production");
}

export function stravaSubscriptionMaintenanceEnabled() {
  return flag(
    "STRAVA_SUBSCRIPTION_MAINTENANCE_ENABLED",
    getStravaRuntimeMode() === "production",
  );
}

export function stravaRevokeEnabled() {
  return flag("STRAVA_REVOKE_ENABLED", getStravaRuntimeMode() === "production");
}

export function stravaOauthEnabled() {
  return getStravaRuntimeMode() !== "simulated";
}

function flag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

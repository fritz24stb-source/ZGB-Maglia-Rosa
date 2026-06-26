export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type ServerEnv = PublicEnv & {
  supabaseServiceRoleKey: string;
  stravaClientId: string;
  stravaClientSecret: string;
  stravaVerifyToken: string;
  stravaWebhookCallbackUrl: string;
  appBaseUrl: string;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabaseAnonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}

export function getServerEnv(): ServerEnv {
  return {
    ...getPublicEnv(),
    supabaseServiceRoleKey: requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    stravaClientId: requireEnv(
      "STRAVA_CLIENT_ID",
      process.env.STRAVA_CLIENT_ID,
    ),
    stravaClientSecret: requireEnv(
      "STRAVA_CLIENT_SECRET",
      process.env.STRAVA_CLIENT_SECRET,
    ),
    stravaVerifyToken: requireEnv(
      "STRAVA_VERIFY_TOKEN",
      process.env.STRAVA_VERIFY_TOKEN,
    ),
    stravaWebhookCallbackUrl: requireEnv(
      "STRAVA_WEBHOOK_CALLBACK_URL",
      process.env.STRAVA_WEBHOOK_CALLBACK_URL,
    ),
    appBaseUrl: requireEnv("APP_BASE_URL", process.env.APP_BASE_URL),
  };
}

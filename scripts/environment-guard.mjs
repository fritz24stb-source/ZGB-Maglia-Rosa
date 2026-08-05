export function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function assertProjectTarget({ url, expectedRef, allowProduction = false }) {
  const normalized = url.toLowerCase();
  if (!normalized.includes(expectedRef.toLowerCase())) {
    throw new Error(`Target URL does not contain expected project ref '${expectedRef}'.`);
  }

  const appEnv = process.env.APP_ENV?.toLowerCase();
  if (!allowProduction && (appEnv === "production" || process.env.VERCEL_ENV === "production")) {
    throw new Error("Staging tools are disabled in production environments.");
  }
}

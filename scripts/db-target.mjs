import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertProjectTarget, requireEnvironment } from "./environment-guard.mjs";

const [target, action] = process.argv.slice(2);
if (!['staging', 'production'].includes(target) || !['status', 'dry-run', 'push'].includes(action)) {
  throw new Error("Usage: node scripts/db-target.mjs <staging|production> <status|dry-run|push>");
}

const production = target === "production";
const urlName = production ? "PRODUCTION_DATABASE_URL" : "STAGING_DATABASE_URL";
const refName = production ? "EXPECTED_PRODUCTION_PROJECT_REF" : "EXPECTED_SUPABASE_PROJECT_REF";
const dbUrl = requireEnvironment(urlName);
const expectedRef = requireEnvironment(refName);
assertProjectTarget({ url: dbUrl, expectedRef, allowProduction: production });

if (production && action === "push") {
  const confirmation = requireEnvironment("CONFIRM_PRODUCTION_REF");
  if (confirmation !== expectedRef) {
    throw new Error("Production confirmation does not match EXPECTED_PRODUCTION_PROJECT_REF.");
  }
}

const cliEntrypoint = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));
const args = action === "status"
  ? ["migration", "list", "--db-url", dbUrl]
  : ["db", "push", "--db-url", dbUrl, ...(action === "dry-run" ? ["--dry-run", "--include-all"] : ["--include-all"])];
const result = spawnSync(process.execPath, [cliEntrypoint, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: false,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

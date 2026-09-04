import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertProjectTarget,
  requireEnvironment,
} from "./environment-guard.mjs";

const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const expectedRef = requireEnvironment("EXPECTED_SUPABASE_PROJECT_REF");

requireEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY");
requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
assertProjectTarget({ url, expectedRef });

const vitestEntrypoint = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [
    vitestEntrypoint,
    "run",
    "tests/classifications-database.integration.test.ts",
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, RUN_SUPABASE_INTEGRATION: "1" },
    stdio: "inherit",
    shell: false,
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);

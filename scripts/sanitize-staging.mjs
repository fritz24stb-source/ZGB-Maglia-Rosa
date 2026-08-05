import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertProjectTarget, requireEnvironment } from "./environment-guard.mjs";

const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const expectedRef = requireEnvironment("EXPECTED_SUPABASE_PROJECT_REF");
assertProjectTarget({ url, expectedRef });

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const tables = [
  "webhook_events",
  "strava_connections",
  "app_passkey_credentials",
  "app_user_credentials",
  "app_invites",
];

for (const table of tables) {
  const { error } = await client.from(table).delete().not("created_at", "is", null);
  if (error) throw new Error(`Could not sanitize ${table}: ${error.message}`);
}

for (let page = 1; ; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const user of data.users) {
    const { error: updateError } = await client.auth.admin.updateUserById(user.id, {
      password: randomBytes(48).toString("base64url"),
    });
    if (updateError) throw updateError;
  }
  if (data.users.length < 1000) break;
}

console.log(`Sanitized staging project ${expectedRef}. Production profile and activity data were retained.`);

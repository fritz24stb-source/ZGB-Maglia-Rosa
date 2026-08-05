import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { assertProjectTarget, requireEnvironment } from "./environment-guard.mjs";

const scrypt = promisify(scryptCallback);
const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const expectedRef = requireEnvironment("EXPECTED_SUPABASE_PROJECT_REF");
const password = requireEnvironment("LOCAL_ADMIN_PASSWORD");
assertProjectTarget({ url, expectedRef });
if (password.length < 14) throw new Error("LOCAL_ADMIN_PASSWORD must contain at least 14 characters.");

const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `local-admin@${expectedRef}.test.local`;
let user = null;
for (let page = 1; !user; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((candidate) => candidate.email === email) ?? null;
  if (data.users.length < 1000) break;
}

if (!user) {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: randomBytes(48).toString("base64url"),
    email_confirm: true,
    user_metadata: { auth_provider: "local-test", display_name: "Local Admin" },
  });
  if (error || !data.user) throw error ?? new Error("Local admin auth user was not created.");
  user = data.user;
}

const { error: profileError } = await client.from("profiles").upsert({
  id: user.id,
  display_name: "Local Admin",
  role: "admin",
  is_active: true,
});
if (profileError) throw profileError;

const salt = randomBytes(16).toString("base64url");
const derived = await scrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = ["scrypt", 16384, 8, 1, salt, Buffer.from(derived).toString("base64url")].join("$");
const { error: credentialError } = await client.from("app_user_credentials").upsert({
  user_id: user.id,
  password_hash: passwordHash,
});
if (credentialError) throw credentialError;

console.log(`Local Admin is ready in staging project ${expectedRef}.`);

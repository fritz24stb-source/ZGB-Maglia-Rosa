import type { SupabaseClient } from "@supabase/supabase-js";
import { redactSensitiveValue } from "@/lib/security/redaction";
import type { Database, Json } from "@/types/database";

type AuditInput = {
  action: string;
  after?: unknown;
  before?: unknown;
  entityId?: string | null;
  entityType: string;
};

export async function writeAdminAuditLog(
  client: SupabaseClient<Database>,
  input: AuditInput,
) {
  const { error } = await client.from("audit_log").insert({
    actor_user_id: null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before: toAuditJson(input.before),
    after: toAuditJson(input.after),
  });

  if (error) {
    throw error;
  }
}

function toAuditJson(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  return redactSensitiveValue(value, {
    maxDepth: 8,
    maxStringLength: 4000,
  }) as Json;
}

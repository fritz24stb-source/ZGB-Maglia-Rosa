import type { SupabaseClient } from "@supabase/supabase-js";
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
    before: (input.before ?? null) as Json | null,
    after: (input.after ?? null) as Json | null,
  });

  if (error) {
    throw error;
  }
}

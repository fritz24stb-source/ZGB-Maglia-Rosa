import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  getFormCheckbox,
  getFormInteger,
  getFormText,
  getOptionalFormNumber,
  getOptionalFormText,
  parseIntegerList,
  parseTextList,
  requireTextList,
} from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import {
  MANUAL_ENTRY_TIME_ZONE,
  parseManualLocalDateTime,
} from "@/lib/manual-entry/time";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type RuleUpdate = Database["public"]["Tables"]["scoring_rules"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const formData = await request.formData();
    const action = getFormText(formData, "action", "Aktion fehlt.");
    const supabase = createSupabaseServiceRoleClient();

    if (action === "create") {
      const payload = buildRulePayload(formData);
      const { data, error } = await supabase
        .from("scoring_rules")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: "rule.create",
        after: data,
        entityId: data.id,
        entityType: "scoring_rule",
      });

      return redirectWithAdminFlash(request, "/admin/rules", {
        status: "Regel wurde angelegt.",
      });
    }

    if (action === "update") {
      const id = getFormText(formData, "id", "Regel-ID fehlt.");
      const before = await getRule(supabase, id);
      const payload = buildRulePayload(formData);
      const { data, error } = await supabase
        .from("scoring_rules")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: "rule.update",
        after: data,
        before,
        entityId: id,
        entityType: "scoring_rule",
      });

      return redirectWithAdminFlash(request, "/admin/rules", {
        status: "Regel wurde aktualisiert.",
      });
    }

    if (action === "toggle-active") {
      const id = getFormText(formData, "id", "Regel-ID fehlt.");
      const isActive = getFormCheckbox(formData, "isActive");
      const before = await getRule(supabase, id);
      const { data, error } = await supabase
        .from("scoring_rules")
        .update({ is_active: isActive })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: isActive ? "rule.activate" : "rule.deactivate",
        after: data,
        before,
        entityId: id,
        entityType: "scoring_rule",
      });

      return redirectWithAdminFlash(request, "/admin/rules", {
        status: isActive
          ? "Regel wurde aktiviert."
          : "Regel wurde deaktiviert.",
      });
    }

    throw new Error("Unbekannte Regel-Aktion.");
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/rules", {
      error: formatAdminError(error),
    });
  }
}

function buildRulePayload(formData: FormData): RuleUpdate {
  const ruleType = getFormText(formData, "ruleType", "Regeltyp fehlt.");

  if (ruleType !== "standard" && ruleType !== "special") {
    throw new Error("Regeltyp muss standard oder special sein.");
  }

  const seasonId = getOptionalFormText(formData, "seasonId");
  const minDistanceKm = getOptionalFormNumber(formData, "minDistanceKm", {
    min: 0,
  });
  const allowedWeekdays = parseIntegerList(
    getOptionalFormText(formData, "allowedWeekdays"),
    { max: 7, min: 1 },
  );
  const allowedSportTypes = parseTextList(
    getOptionalFormText(formData, "allowedSportTypes"),
  );

  return {
    season_id: seasonId === "global" ? null : seasonId,
    name: getFormText(formData, "name", "Regelname fehlt."),
    category: getFormText(formData, "category", "Kategorie fehlt."),
    points: getFormInteger(formData, "points", { min: 1 }),
    rule_type: ruleType,
    priority: getFormInteger(formData, "priority", { defaultValue: 100 }),
    name_keywords: requireTextList(
      getOptionalFormText(formData, "nameKeywords"),
      "Mindestens ein Keyword ist erforderlich.",
    ),
    allowed_weekdays: allowedWeekdays,
    valid_from: parseOptionalLocalDateTime(
      getOptionalFormText(formData, "validFrom"),
    ),
    valid_until: parseOptionalLocalDateTime(
      getOptionalFormText(formData, "validUntil"),
    ),
    min_distance_m:
      minDistanceKm === null ? null : Math.round(minDistanceKm * 1000),
    allowed_sport_types:
      allowedSportTypes.length > 0 ? allowedSportTypes : null,
    manual_entry_allowed: getFormCheckbox(formData, "manualEntryAllowed"),
    manual_entry_valid_from_rule: getOptionalFormText(
      formData,
      "manualEntryValidFromRule",
    ),
    manual_entry_valid_until_rule: getOptionalFormText(
      formData,
      "manualEntryValidUntilRule",
    ),
    max_manual_entries_per_user: getFormInteger(
      formData,
      "maxManualEntriesPerUser",
      { defaultValue: 1, min: 1 },
    ),
    is_active: getFormCheckbox(formData, "isActive"),
  };
}

function parseOptionalLocalDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = parseManualLocalDateTime(value, MANUAL_ENTRY_TIME_ZONE);

  if (!parsed) {
    throw new Error("Datum/Zeit muss gueltig sein.");
  }

  return parsed.utcDate.toISOString();
}

async function getRule(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  id: string,
) {
  const { data, error } = await supabase
    .from("scoring_rules")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}

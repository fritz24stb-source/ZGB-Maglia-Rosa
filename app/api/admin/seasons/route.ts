import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getFormText } from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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
      const name = getFormText(formData, "name", "Saisonname fehlt.");
      const startsOn = getFormText(formData, "startsOn", "Startdatum fehlt.");
      const endsOn = getFormText(formData, "endsOn", "Enddatum fehlt.");
      const isActive = formData.get("isActive") === "on";

      validateDateRange(startsOn, endsOn);

      if (isActive) {
        await deactivateAllSeasons(supabase);
      }

      const { data, error } = await supabase
        .from("seasons")
        .insert({
          name,
          starts_on: startsOn,
          ends_on: endsOn,
          is_active: isActive,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: "season.create",
        after: data,
        entityId: data.id,
        entityType: "season",
      });

      return redirectWithAdminFlash(request, "/admin/seasons", {
        status: "Saison wurde angelegt.",
      });
    }

    if (action === "update") {
      const id = getFormText(formData, "id", "Saison-ID fehlt.");
      const name = getFormText(formData, "name", "Saisonname fehlt.");
      const startsOn = getFormText(formData, "startsOn", "Startdatum fehlt.");
      const endsOn = getFormText(formData, "endsOn", "Enddatum fehlt.");

      validateDateRange(startsOn, endsOn);

      const before = await getSeason(supabase, id);
      const { data, error } = await supabase
        .from("seasons")
        .update({
          name,
          starts_on: startsOn,
          ends_on: endsOn,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: "season.update",
        after: data,
        before,
        entityId: id,
        entityType: "season",
      });

      return redirectWithAdminFlash(request, "/admin/seasons", {
        status: "Saison wurde aktualisiert.",
      });
    }

    if (action === "set-active") {
      const id = getFormText(formData, "id", "Saison-ID fehlt.");
      const before = await getSeason(supabase, id);

      await deactivateAllSeasons(supabase);

      const { data, error } = await supabase
        .from("seasons")
        .update({ is_active: true })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: "season.set_active",
        after: data,
        before,
        entityId: id,
        entityType: "season",
      });

      return redirectWithAdminFlash(request, "/admin/seasons", {
        status: "Aktive Saison wurde gesetzt.",
      });
    }

    throw new Error("Unbekannte Saison-Aktion.");
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/seasons", {
      error: formatAdminError(error),
    });
  }
}

async function deactivateAllSeasons(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
) {
  const { error } = await supabase
    .from("seasons")
    .update({ is_active: false })
    .eq("is_active", true);

  if (error) {
    throw error;
  }
}

async function getSeason(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  id: string,
) {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function validateDateRange(startsOn: string, endsOn: string) {
  if (!isDateInput(startsOn) || !isDateInput(endsOn)) {
    throw new Error("Saisondaten muessen im Format YYYY-MM-DD vorliegen.");
  }

  if (endsOn < startsOn) {
    throw new Error("Saisonende darf nicht vor Saisonstart liegen.");
  }
}

function isDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}

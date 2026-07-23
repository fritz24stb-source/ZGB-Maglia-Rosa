import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
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
    const eventId = formData.get("eventId");

    if (typeof eventId !== "string" || !eventId) {
      throw new Error("Webhook Event konnte nicht bestimmt werden.");
    }

    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: "Manuell durch Admin ignoriert.",
        processing_status: "ignored",
      })
      .eq("id", eventId)
      .eq("processing_status", "failed")
      .select("id, processing_error, processing_status")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Webhook Event ist nicht mehr fehlgeschlagen.");
    }

    await writeAdminAuditLog(supabase, {
      action: "webhook.ignore_failed",
      after: data,
      entityId: eventId,
      entityType: "webhook_event",
    });

    return redirectWithAdminFlash(
      request,
      "/admin/webhooks?status=failed",
      { status: "Webhook Event wurde manuell ignoriert." },
    );
  } catch (error) {
    return redirectWithAdminFlash(
      request,
      "/admin/webhooks?status=failed",
      { error: formatAdminError(error) },
    );
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}

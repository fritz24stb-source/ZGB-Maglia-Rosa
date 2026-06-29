import { NextResponse, type NextRequest } from "next/server";
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

    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);

    if (error) {
      throw error;
    }

    return redirectWithAdminFlash(request, "/admin", {
      status: "Alle Benachrichtigungen wurden als gelesen markiert.",
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin", {
      error: formatAdminError(error),
    });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}

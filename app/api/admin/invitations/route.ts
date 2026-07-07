import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getOptionalFormText } from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { isUniqueViolation } from "@/lib/auth/app-auth";
import {
  buildInviteLink,
  buildInviteTokenHint,
  generateInviteToken,
  hashInviteToken,
  normalizeInviteToken,
} from "@/lib/auth/invites";
import { sendInvitationEmail } from "@/lib/invitations/email";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const formData = await request.formData();
    const action = getOptionalFormText(formData, "action");

    if (action === "create_single") {
      return await createSingleInvite(request, formData);
    }

    if (action === "create_group") {
      return await createGroupInvite(request, formData);
    }

    throw new Error("Ungültige Einladungsaktion.");
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/invitations", {
      error: formatAdminError(error),
    });
  }
}

async function createSingleInvite(request: NextRequest, formData: FormData) {
  const email = normalizeEmail(getOptionalFormText(formData, "email"));
  const expiresAt = parseExpiresAt(getOptionalFormText(formData, "expiresAt"));
  const token = generateInviteToken();
  const inviteLink = buildInviteLink(token);
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("app_invites")
    .insert({
      email,
      email_delivery_error: null,
      email_delivery_status: "skipped",
      expires_at: expiresAt,
      invite_type: "single",
      max_uses: 1,
      sent_at: null,
      token_hash: hashInviteToken(token),
      token_hint: buildInviteTokenHint(token),
      use_count: 0,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Einladungscode existiert bereits.");
    }

    throw error;
  }

  const emailResult = email
    ? await sendInvitationEmail({ inviteLink, to: email })
    : { error: null, status: "skipped" as const };

  const updateResult = await supabase
    .from("app_invites")
    .update({
      email_delivery_error: emailResult.error,
      email_delivery_status: emailResult.status,
      sent_at: emailResult.status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", data.id)
    .select("*")
    .single();

  if (updateResult.error) {
    throw updateResult.error;
  }

  await writeAdminAuditLog(supabase, {
    action: "invite.create_single",
    after: updateResult.data,
    before: null,
    entityId: data.id,
    entityType: "app_invite",
  });

  return redirectWithInviteResult(
    request,
    token,
    buildInviteStatus(emailResult),
  );
}

async function createGroupInvite(request: NextRequest, formData: FormData) {
  const customCode = getOptionalFormText(formData, "groupCode");
  const token = customCode
    ? normalizeInviteToken(customCode)
    : generateInviteToken();
  const expiresAt = parseExpiresAt(getOptionalFormText(formData, "expiresAt"));
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const revokeResult = await supabase
    .from("app_invites")
    .update({ revoked_at: now })
    .eq("invite_type", "group")
    .is("revoked_at", null);

  if (revokeResult.error) {
    throw revokeResult.error;
  }

  const { data, error } = await supabase
    .from("app_invites")
    .insert({
      email: null,
      email_delivery_error: null,
      email_delivery_status: "skipped",
      expires_at: expiresAt,
      invite_type: "group",
      max_uses: null,
      sent_at: null,
      token_hash: hashInviteToken(token),
      token_hint: buildInviteTokenHint(token),
      use_count: 0,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Gruppencode existiert bereits.");
    }

    throw error;
  }

  await writeAdminAuditLog(supabase, {
    action: "invite.create_group",
    after: data,
    before: null,
    entityId: data.id,
    entityType: "app_invite",
  });

  return redirectWithInviteResult(
    request,
    token,
    "Gruppenlink wurde erstellt.",
  );
}

function redirectWithInviteResult(
  request: NextRequest,
  token: string,
  status: string,
) {
  const url = new URL("/admin/invitations", request.url);
  url.searchParams.set("adminStatus", status);
  url.searchParams.set("inviteToken", token);

  return NextResponse.redirect(url, { status: 303 });
}

function normalizeEmail(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("E-Mail-Adresse ist ungültig.");
  }

  return normalized;
}

function parseExpiresAt(value: string | null) {
  if (!value) {
    throw new Error("Ablaufdatum fehlt.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Ablaufdatum ist ungültig.");
  }

  if (date.getTime() <= Date.now()) {
    throw new Error("Ablaufdatum muss in der Zukunft liegen.");
  }

  return date.toISOString();
}

function buildInviteStatus(emailResult: {
  error: string | null;
  status: "failed" | "sent" | "skipped";
}) {
  if (emailResult.status === "sent") {
    return "Einmal-Link wurde erstellt und versendet.";
  }

  if (emailResult.status === "failed") {
    return "Einmal-Link wurde erstellt. E-Mailversand ist fehlgeschlagen.";
  }

  return "Einmal-Link wurde erstellt.";
}

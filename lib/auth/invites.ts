import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppBaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

export type AppInvite = Database["public"]["Tables"]["app_invites"]["Row"];

export function generateInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function normalizeInviteToken(value: string) {
  const token = value.trim();

  if (!token) {
    throw new Error("Einladungscode fehlt.");
  }

  if (token.length > 160) {
    throw new Error("Einladungscode ist zu lang.");
  }

  return token;
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(normalizeInviteToken(token)).digest("hex");
}

export function buildInviteLink(token: string) {
  const url = new URL("/register", getAppBaseUrl());
  url.searchParams.set("invite", token);

  return url.toString();
}

export function buildInviteTokenHint(token: string) {
  const normalized = normalizeInviteToken(token);

  if (normalized.length <= 10) {
    return normalized;
  }

  return `${normalized.slice(0, 5)}...${normalized.slice(-5)}`;
}

export async function loadInviteByToken(
  serviceClient: ServiceClient,
  token: string,
) {
  const { data, error } = await serviceClient
    .from("app_invites")
    .select("*")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AppInvite | null;
}

export function assertInviteCanBeUsed(
  invite: AppInvite | null,
  now = new Date(),
) {
  if (!invite) {
    throw new Error("Einladung ist ungültig.");
  }

  if (invite.revoked_at) {
    throw new Error("Einladung wurde widerrufen.");
  }

  if (new Date(invite.expires_at).getTime() < now.getTime()) {
    throw new Error("Einladung ist abgelaufen.");
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    throw new Error("Einladung wurde bereits verwendet.");
  }
}

export async function consumeInvite(
  serviceClient: ServiceClient,
  inviteId: string,
  userId: string,
) {
  const { data, error } = await serviceClient.rpc("consume_app_invite", {
    p_invite_id: inviteId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error("Einladung konnte nicht mehr verwendet werden.");
  }

  return data as AppInvite;
}

export function isInviteUsable(invite: AppInvite, now = new Date()) {
  try {
    assertInviteCanBeUsed(invite, now);
    return true;
  } catch {
    return false;
  }
}

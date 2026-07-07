import "server-only";

import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;
type ManualProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id" | "is_active"
>;

const MANUAL_EMAIL_DOMAIN = "members.zgb-manual.local";
const MANUAL_NAME_MAX_LENGTH = 80;

export async function findOrCreateManualParticipantProfile(
  serviceClient: ServiceClient,
  displayName: string,
): Promise<ManualProfile> {
  const normalizedDisplayName = normalizeManualParticipantName(displayName);
  const existingProfile = await findActiveProfileByDisplayName(
    serviceClient,
    normalizedDisplayName,
  );

  if (existingProfile) {
    return existingProfile;
  }

  const inactiveProfile = await findInactiveProfileByDisplayName(
    serviceClient,
    normalizedDisplayName,
  );

  if (inactiveProfile) {
    throw new Error("Für diesen Namen existiert ein inaktives Profil.");
  }

  const env = getSupabaseServiceEnv();
  const email = buildManualParticipantEmail(normalizedDisplayName);
  const password = buildManualParticipantPassword(
    normalizedDisplayName,
    env.supabaseServiceRoleKey,
  );
  const user = await findAuthUserByEmail(serviceClient, email);
  const userId =
    user?.id ??
    (await createManualAuthUser(
      serviceClient,
      email,
      password,
      normalizedDisplayName,
    ));

  const { data, error } = await serviceClient
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: normalizedDisplayName,
        role: "member",
        is_active: true,
      },
      { onConflict: "id" },
    )
    .select("id, display_name, is_active")
    .single();

  if (error) {
    throw error;
  }

  return data as ManualProfile;
}

export function normalizeManualParticipantName(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error("Name fehlt.");
  }

  if (normalized.length > MANUAL_NAME_MAX_LENGTH) {
    throw new Error(
      `Name darf maximal ${MANUAL_NAME_MAX_LENGTH} Zeichen lang sein.`,
    );
  }

  return normalized;
}

export function buildManualParticipantEmail(displayName: string) {
  const digest = createHash("sha256")
    .update(normalizeNameKey(displayName))
    .digest("hex")
    .slice(0, 24);

  return `manual-${digest}@${MANUAL_EMAIL_DOMAIN}`;
}

function buildManualParticipantPassword(displayName: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`manual:${normalizeNameKey(displayName)}`)
    .digest("hex");
}

async function findActiveProfileByDisplayName(
  serviceClient: ServiceClient,
  displayName: string,
) {
  const matches = await findProfilesByDisplayName(serviceClient, displayName);
  const activeMatches = matches.filter((profile) => profile.is_active);

  if (activeMatches.length > 1) {
    throw new Error("Dieser Name ist mehreren aktiven Profilen zugeordnet.");
  }

  return activeMatches[0] ?? null;
}

async function findInactiveProfileByDisplayName(
  serviceClient: ServiceClient,
  displayName: string,
) {
  const matches = await findProfilesByDisplayName(serviceClient, displayName);

  return matches.find((profile) => !profile.is_active) ?? null;
}

async function findProfilesByDisplayName(
  serviceClient: ServiceClient,
  displayName: string,
) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, display_name, is_active")
    .limit(10000);

  if (error) {
    throw error;
  }

  const nameKey = normalizeNameKey(displayName);

  return ((data ?? []) as ManualProfile[]).filter(
    (profile) => normalizeNameKey(profile.display_name) === nameKey,
  );
}

async function findAuthUserByEmail(
  serviceClient: ServiceClient,
  email: string,
) {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createManualAuthUser(
  serviceClient: ServiceClient,
  email: string,
  password: string,
  displayName: string,
) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      auth_provider: "manual",
      display_name: displayName,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Supabase did not return a user after createUser.");
  }

  return data.user.id;
}

function normalizeNameKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de");
}

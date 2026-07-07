import "server-only";

import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { AccessBlocked } from "@/components/access-blocked";
import { decideAdminAccess } from "@/lib/auth/admin-access";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";

export async function requireActiveAppPage(nextPath: string) {
  const state = await loadCurrentAppAccessState();

  if (state.kind === "anonymous") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (state.kind === "blocked") {
    return <AccessBlocked />;
  }

  return null;
}

export async function requireAdminAppPage(nextPath: string) {
  const state = await loadCurrentAppAccessState();

  if (state.kind === "anonymous") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (state.kind === "blocked") {
    return <AccessBlocked />;
  }

  const decision = decideAdminAccess(state.profile);

  if (!decision.allowed) {
    return (
      <AccessDenied
        title="Adminzugriff gesperrt"
        description="Dieses Profil hat keine Admin-Rolle. Melde dich mit einem Admin-Profil an."
      />
    );
  }

  return null;
}

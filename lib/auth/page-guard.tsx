import "server-only";

import { redirect } from "next/navigation";
import { AccessBlocked } from "@/components/access-blocked";
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

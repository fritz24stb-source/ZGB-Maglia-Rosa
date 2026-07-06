import { Mail, Ticket, Trash2 } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { CopyInviteLink } from "@/components/copy-invite-link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buildInviteLink } from "@/lib/auth/invites";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminInvitationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InviteRow = Database["public"]["Tables"]["app_invites"]["Row"];

type InvitationState =
  | { kind: "ready"; invites: InviteRow[] }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

export default async function AdminInvitationsPage({
  searchParams,
}: AdminInvitationsPageProps) {
  const params = searchParams ? await searchParams : {};
  const inviteToken = getSingleParam(params.inviteToken);
  const inviteLink = inviteToken ? buildInviteLink(inviteToken) : null;
  const state = await loadInvitationState();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Einladungen"
        description="Einmalige Registrierungslinks und Gruppenlinks mit Ablaufdatum."
      />
      <AdminFlash
        error={getSingleParam(params.adminError)}
        status={getSingleParam(params.adminStatus)}
      />

      {inviteLink ? (
        <section className="rounded-lg border border-green-200 bg-green-50 p-5 text-green-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="grid flex-1 gap-1 text-sm font-medium">
              Erstellter Link
              <input
                className="focus-ring min-h-10 rounded-md border border-green-300 bg-white px-3 text-sm text-asphalt-900"
                readOnly
                value={inviteLink}
              />
            </label>
            <CopyInviteLink value={inviteLink} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
          <div className="flex items-center gap-2">
            <Mail aria-hidden className="h-5 w-5 text-signal-blue" />
            <h2 className="text-base font-semibold text-asphalt-900">
              Einmal-Link
            </h2>
          </div>
          <form
            action="/api/admin/invitations"
            className="mt-4 grid gap-4"
            method="post"
          >
            <input name="action" type="hidden" value="create_single" />
            <label className="grid gap-1 text-sm font-medium text-asphalt-800">
              E-Mail optional
              <input
                className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                name="email"
                type="email"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-asphalt-800">
              Ablauf
              <input
                className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                defaultValue={defaultExpiryInput(14)}
                name="expiresAt"
                required
                type="datetime-local"
              />
            </label>
            <button
              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
              type="submit"
            >
              <Mail aria-hidden className="h-4 w-4" />
              Einmal-Link erstellen
            </button>
          </form>
        </article>

        <article className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
          <div className="flex items-center gap-2">
            <Ticket aria-hidden className="h-5 w-5 text-signal-blue" />
            <h2 className="text-base font-semibold text-asphalt-900">
              Gruppenlink
            </h2>
          </div>
          <form
            action="/api/admin/invitations"
            className="mt-4 grid gap-4"
            method="post"
          >
            <input name="action" type="hidden" value="create_group" />
            <label className="grid gap-1 text-sm font-medium text-asphalt-800">
              Code optional
              <input
                className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                name="groupCode"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-asphalt-800">
              Ablauf
              <input
                className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
                defaultValue={defaultExpiryInput(30)}
                name="expiresAt"
                required
                type="datetime-local"
              />
            </label>
            <button
              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
              type="submit"
            >
              <Ticket aria-hidden className="h-4 w-4" />
              Gruppenlink setzen
            </button>
          </form>
        </article>
      </section>

      {state.kind === "error" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {state.message}
        </section>
      ) : (
        <InvitationList invites={state.invites} />
      )}
    </main>
  );
}

function InvitationList({ invites }: { invites: InviteRow[] }) {
  if (invites.length === 0) {
    return (
      <section className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">
        Noch keine Einladungen vorhanden.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-asphalt-200 bg-white shadow-line">
      <div className="border-b border-asphalt-100 p-4">
        <h2 className="text-base font-semibold text-asphalt-900">
          Letzte Einladungen
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left text-sm">
          <thead className="bg-asphalt-50 text-xs uppercase text-asphalt-500">
            <tr>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3">Nutzung</th>
              <th className="px-4 py-3">Ablauf</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-asphalt-100">
            {invites.map((invite) => (
              <tr key={invite.id}>
                <td className="px-4 py-3">
                  {invite.invite_type === "single" ? "Einmal" : "Gruppe"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {invite.token_hint}
                </td>
                <td className="px-4 py-3">{invite.email ?? "-"}</td>
                <td className="px-4 py-3">
                  {invite.use_count}/{invite.max_uses ?? "offen"}
                </td>
                <td className="px-4 py-3">
                  {formatDateTime(invite.expires_at)}
                </td>
                <td className="px-4 py-3">
                  <InviteStatus invite={invite} />
                </td>
                <td className="px-4 py-3">
                  {invite.revoked_at ? null : (
                    <form
                      action={`/api/admin/invitations/${invite.id}`}
                      method="post"
                    >
                      <button
                        className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-medium text-red-800"
                        type="submit"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                        Widerrufen
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InviteStatus({ invite }: { invite: InviteRow }) {
  if (invite.revoked_at) {
    return <StatusBadge tone="danger">widerrufen</StatusBadge>;
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return <StatusBadge tone="warning">abgelaufen</StatusBadge>;
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return <StatusBadge tone="neutral">verwendet</StatusBadge>;
  }

  return <StatusBadge tone="success">aktiv</StatusBadge>;
}

async function loadInvitationState(): Promise<InvitationState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("app_invites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return { kind: "ready", invites: (data ?? []) as InviteRow[] };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Einladungen konnten nicht geladen werden.",
    };
  }
}

function defaultExpiryInput(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(23, 59, 0, 0);

  return [
    value.getFullYear(),
    "-",
    padDatePart(value.getMonth() + 1),
    "-",
    padDatePart(value.getDate()),
    "T",
    padDatePart(value.getHours()),
    ":",
    padDatePart(value.getMinutes()),
  ].join("");
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

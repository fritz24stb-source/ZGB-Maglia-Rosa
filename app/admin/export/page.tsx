import { Download } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminExportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id"
>;
type SeasonRow = Pick<
  Database["public"]["Tables"]["seasons"]["Row"],
  "ends_on" | "id" | "is_active" | "name" | "starts_on"
>;

type ExportState =
  | { kind: "ready"; profiles: ProfileRow[]; seasons: SeasonRow[] }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

export default async function AdminExportPage({
  searchParams,
}: AdminExportPageProps) {
  const params = searchParams ? await searchParams : {};
  const state = await loadExportState();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="CSV Export"
        description="Gefilterte Leaderboard- und Aktivitätsdaten als CSV herunterladen."
      />
      <AdminFlash
        error={getSingleParam(params.adminError)}
        status={getSingleParam(params.adminStatus)}
      />

      {state.kind === "error" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {state.message}
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          <ExportCard
            action="/api/admin/export/leaderboard"
            profiles={state.profiles}
            seasons={state.seasons}
            title="Leaderboard CSV"
            withStatus={false}
          />
          <ExportCard
            action="/api/admin/export/activities"
            profiles={state.profiles}
            seasons={state.seasons}
            title="Aktivitäten CSV"
            withStatus
          />
        </section>
      )}
    </main>
  );
}

function ExportCard({
  action,
  profiles,
  seasons,
  title,
  withStatus,
}: {
  action: string;
  profiles: ProfileRow[];
  seasons: SeasonRow[];
  title: string;
  withStatus: boolean;
}) {
  const activeSeasonId =
    seasons.find((season) => season.is_active)?.id ?? "all";

  return (
    <form
      action={action}
      className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line"
      method="get"
    >
      <div className="flex items-center gap-2">
        <Download aria-hidden className="h-5 w-5 text-signal-blue" />
        <h2 className="text-base font-semibold text-asphalt-900">{title}</h2>
      </div>
      <div className="mt-5 grid gap-4">
        <SelectField label="Saison" name="seasonId" value={activeSeasonId}>
          <option value="all">Alle Saisons</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
              {season.is_active ? " (aktiv)" : ""}
            </option>
          ))}
        </SelectField>
        <SelectField label="Mitglied" name="memberId" value="all">
          <option value="all">Alle Mitglieder</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.display_name}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Quelle" name="source" value="all">
            <option value="all">Alle</option>
            <option value="strava">Strava</option>
            <option value="manual">Manuell</option>
          </SelectField>
          {withStatus ? (
            <SelectField label="Status" name="status" value="all">
              <option value="all">Alle</option>
              <option value="active">active</option>
              <option value="ignored">ignored</option>
              <option value="deleted">deleted</option>
            </SelectField>
          ) : (
            <SelectField label="Kategorie" name="category" value="all">
              <option value="all">Alle</option>
              <option value="fondo">fondo</option>
              <option value="zug">zug</option>
              <option value="scuola">scuola</option>
              <option value="scuderia">scuderia</option>
              <option value="sonderevent">sonderevent</option>
            </SelectField>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label="Von" name="from" />
          <DateField label="Bis" name="to" />
        </div>
      </div>
      <button
        type="submit"
        className="focus-ring mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
      >
        <Download aria-hidden className="h-4 w-4" />
        CSV herunterladen
      </button>
    </form>
  );
}

function SelectField({
  children,
  label,
  name,
  value,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <select
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={value}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

function DateField({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        name={name}
        type="date"
      />
    </label>
  );
}

async function loadExportState(): Promise<ExportState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const [profilesResult, seasonsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .order("display_name", { ascending: true }),
      supabase
        .from("seasons")
        .select("id, name, starts_on, ends_on, is_active")
        .order("starts_on", { ascending: false }),
    ]);

    if (profilesResult.error || seasonsResult.error) {
      throw profilesResult.error ?? seasonsResult.error;
    }

    return {
      kind: "ready",
      profiles: (profilesResult.data ?? []) as ProfileRow[],
      seasons: (seasonsResult.data ?? []) as SeasonRow[],
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Exportdaten konnten nicht geladen werden.",
    };
  }
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

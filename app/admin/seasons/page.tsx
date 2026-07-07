import { CalendarDays, Save, Star } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminSeasonsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

type SeasonsState =
  | { kind: "ready"; seasons: SeasonRow[] }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

export default async function AdminSeasonsPage({
  searchParams,
}: AdminSeasonsPageProps) {
  const params = searchParams ? await searchParams : {};
  const state = await loadSeasons();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Saisonverwaltung"
        description="Saisons anlegen, Zeiträume pflegen und genau eine aktive Saison setzen."
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
        <>
          <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden className="h-5 w-5 text-signal-blue" />
              <h2 className="text-base font-semibold text-asphalt-900">
                Neue Saison
              </h2>
            </div>
            <form
              action="/api/admin/seasons"
              method="post"
              className="mt-5 grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
            >
              <input type="hidden" name="action" value="create" />
              <TextField label="Name" name="name" placeholder="Saison 2027" />
              <DateField label="Start" name="startsOn" />
              <DateField label="Ende" name="endsOn" />
              <label className="flex items-center gap-2 text-sm font-medium text-asphalt-800 md:pt-7">
                <input
                  className="h-4 w-4 rounded border-asphalt-300"
                  name="isActive"
                  type="checkbox"
                />
                Aktiv
              </label>
              <button
                type="submit"
                className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white md:col-span-4 md:w-fit"
              >
                <Save aria-hidden className="h-4 w-4" />
                Saison anlegen
              </button>
            </form>
          </section>

          <section className="grid gap-3">
            {state.seasons.map((season) => (
              <article
                key={season.id}
                className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <form
                    action="/api/admin/seasons"
                    method="post"
                    className="grid flex-1 gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]"
                  >
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="id" value={season.id} />
                    <TextField
                      defaultValue={season.name}
                      label="Name"
                      name="name"
                    />
                    <DateField
                      defaultValue={season.starts_on}
                      label="Start"
                      name="startsOn"
                    />
                    <DateField
                      defaultValue={season.ends_on}
                      label="Ende"
                      name="endsOn"
                    />
                    <div className="flex flex-wrap items-center gap-3 md:col-span-3">
                      <StatusBadge
                        tone={season.is_active ? "success" : "neutral"}
                      >
                        {season.is_active ? "Aktiv" : "Inaktiv"}
                      </StatusBadge>
                      <span className="text-xs text-asphalt-500">
                        Aktualisiert: {formatDateTime(season.updated_at)}
                      </span>
                      <button
                        type="submit"
                        className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
                      >
                        <Save aria-hidden className="h-4 w-4" />
                        Speichern
                      </button>
                    </div>
                  </form>

                  {!season.is_active ? (
                    <form action="/api/admin/seasons" method="post">
                      <input type="hidden" name="action" value="set-active" />
                      <input type="hidden" name="id" value={season.id} />
                      <button
                        type="submit"
                        className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white lg:w-auto"
                      >
                        <Star aria-hidden className="h-4 w-4" />
                        Aktiv setzen
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function TextField({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required
      />
    </label>
  );
}

function DateField({
  defaultValue,
  label,
  name,
}: {
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={defaultValue}
        name={name}
        required
        type="date"
      />
    </label>
  );
}

async function loadSeasons(): Promise<SeasonsState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("starts_on", { ascending: false });

    if (error) {
      throw error;
    }

    return { kind: "ready", seasons: (data ?? []) as SeasonRow[] };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Saisons konnten nicht geladen werden.",
    };
  }
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

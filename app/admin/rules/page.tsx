import { ListChecks, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { AdminFlash } from "@/components/admin-flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  MANUAL_ENTRY_TIME_ZONE,
  toLocalInputValue,
} from "@/lib/manual-entry/time";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminRulesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RuleRow = Database["public"]["Tables"]["scoring_rules"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

type RulesState =
  | { kind: "ready"; rules: RuleRow[]; seasons: SeasonRow[] }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

export default async function AdminRulesPage({
  searchParams,
}: AdminRulesPageProps) {
  const params = searchParams ? await searchParams : {};
  const state = await loadRulesState();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Regelverwaltung"
        description="Standardregeln pruefen, Sonderevents konfigurieren und manuelle Eingabefenster steuern."
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
              <ListChecks aria-hidden className="h-5 w-5 text-signal-blue" />
              <h2 className="text-base font-semibold text-asphalt-900">
                Neues Sonderevent
              </h2>
            </div>
            <RuleForm
              action="create"
              seasons={state.seasons}
              submitLabel="Sonderevent anlegen"
            />
          </section>

          <section className="grid gap-4">
            {state.rules.map((rule) => (
              <article
                key={rule.id}
                className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-asphalt-900">
                        {rule.name}
                      </h2>
                      <StatusBadge
                        tone={rule.rule_type === "special" ? "info" : "neutral"}
                      >
                        {rule.rule_type === "special"
                          ? "Sonderevent"
                          : "Standard"}
                      </StatusBadge>
                      <StatusBadge
                        tone={rule.is_active ? "success" : "warning"}
                      >
                        {rule.is_active ? "Aktiv" : "Inaktiv"}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-asphalt-600">
                      {rule.points} Punkte - Kategorie {rule.category} -
                      Prioritaet {rule.priority}
                    </p>
                  </div>
                  <form action="/api/admin/rules" method="post">
                    <input type="hidden" name="action" value="toggle-active" />
                    <input type="hidden" name="id" value={rule.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={rule.is_active ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
                    >
                      {rule.is_active ? (
                        <ToggleLeft aria-hidden className="h-4 w-4" />
                      ) : (
                        <ToggleRight aria-hidden className="h-4 w-4" />
                      )}
                      {rule.is_active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </form>
                </div>
                <RuleForm
                  action="update"
                  rule={rule}
                  seasons={state.seasons}
                  submitLabel="Regel speichern"
                />
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function RuleForm({
  action,
  rule,
  seasons,
  submitLabel,
}: {
  action: "create" | "update";
  rule?: RuleRow;
  seasons: SeasonRow[];
  submitLabel: string;
}) {
  return (
    <form action="/api/admin/rules" method="post" className="mt-5 grid gap-4">
      <input type="hidden" name="action" value={action} />
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <TextField
          defaultValue={rule?.name ?? ""}
          label="Name"
          name="name"
          placeholder="Sommer Classic"
        />
        <SelectField
          defaultValue={rule?.rule_type ?? "special"}
          label="Typ"
          name="ruleType"
        >
          <option value="standard">Standard</option>
          <option value="special">Sonderevent</option>
        </SelectField>
        <TextField
          defaultValue={rule?.category ?? "sonderevent"}
          label="Kategorie"
          name="category"
        />
        <SelectField
          defaultValue={rule?.season_id ?? "global"}
          label="Saison"
          name="seasonId"
        >
          <option value="global">Global</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
              {season.is_active ? " (aktiv)" : ""}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <NumberField
          defaultValue={String(rule?.points ?? 250)}
          label="Punkte"
          min="1"
          name="points"
        />
        <NumberField
          defaultValue={String(rule?.priority ?? 200)}
          label="Prioritaet"
          name="priority"
        />
        <TextField
          defaultValue={rule?.allowed_weekdays?.join(", ") ?? ""}
          label="Wochentage ISO"
          name="allowedWeekdays"
          placeholder="optional, z.B. 6,7"
          required={false}
        />
        <NumberField
          defaultValue={
            rule?.min_distance_m === null || rule?.min_distance_m === undefined
              ? ""
              : String(rule.min_distance_m / 1000)
          }
          label="Mindestdistanz km"
          min="0"
          name="minDistanceKm"
          required={false}
          step="0.1"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DateTimeField
          defaultValue={toDateTimeLocal(rule?.valid_from)}
          label="Gueltig von"
          name="validFrom"
        />
        <DateTimeField
          defaultValue={toDateTimeLocal(rule?.valid_until)}
          label="Gueltig bis"
          name="validUntil"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextareaField
          defaultValue={rule?.name_keywords.join(", ") ?? ""}
          label="Keywords (UND/ODER)"
          name="nameKeywords"
          placeholder="zgb|zug, mittwoch"
        />
        <TextareaField
          defaultValue={rule?.allowed_sport_types?.join(", ") ?? ""}
          label="Erlaubte Sporttypen"
          name="allowedSportTypes"
          placeholder="optional, z.B. Ride, GravelRide"
          required={false}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr_auto_auto]">
        <CheckboxField
          defaultChecked={rule?.manual_entry_allowed ?? false}
          label="Manuell erlaubt"
          name="manualEntryAllowed"
        />
        <TextField
          defaultValue={rule?.manual_entry_valid_from_rule ?? ""}
          label="Manuell von Regel"
          name="manualEntryValidFromRule"
          placeholder="weekly:saturday:10:00:Europe/Berlin"
          required={false}
        />
        <TextField
          defaultValue={rule?.manual_entry_valid_until_rule ?? ""}
          label="Manuell bis Regel"
          name="manualEntryValidUntilRule"
          placeholder="weekly:sunday:18:00:Europe/Berlin"
          required={false}
        />
        <NumberField
          defaultValue={String(rule?.max_manual_entries_per_user ?? 1)}
          label="Max."
          min="1"
          name="maxManualEntriesPerUser"
        />
        <CheckboxField
          defaultChecked={rule?.is_active ?? true}
          label="Aktiv"
          name="isActive"
        />
      </div>

      <button
        type="submit"
        className="focus-ring inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
      >
        <Save aria-hidden className="h-4 w-4" />
        {submitLabel}
      </button>
    </form>
  );
}

function TextField({
  defaultValue,
  label,
  name,
  placeholder,
  required = true,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function NumberField({
  defaultValue,
  label,
  name,
  required = true,
  ...props
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "name"
>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={defaultValue}
        name={name}
        required={required}
        type="number"
        {...props}
      />
    </label>
  );
}

function SelectField({
  children,
  defaultValue,
  label,
  name,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <select
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
        defaultValue={defaultValue}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

function DateTimeField({
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
        type="datetime-local"
      />
    </label>
  );
}

function TextareaField({
  defaultValue,
  label,
  name,
  placeholder,
  required = true,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <textarea
        className="focus-ring min-h-24 rounded-md border border-asphalt-300 bg-white px-3 py-2 text-sm text-asphalt-900"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function CheckboxField({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-center gap-2 pt-7 text-sm font-medium text-asphalt-800">
      <input
        className="h-4 w-4 rounded border-asphalt-300"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}

async function loadRulesState(): Promise<RulesState> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const [rulesResult, seasonsResult] = await Promise.all([
      supabase
        .from("scoring_rules")
        .select("*")
        .order("rule_type", { ascending: true })
        .order("priority", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("seasons")
        .select("*")
        .order("starts_on", { ascending: false }),
    ]);

    if (rulesResult.error || seasonsResult.error) {
      throw rulesResult.error ?? seasonsResult.error;
    }

    return {
      kind: "ready",
      rules: (rulesResult.data ?? []) as RuleRow[],
      seasons: (seasonsResult.data ?? []) as SeasonRow[],
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Regeln konnten nicht geladen werden.",
    };
  }
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return toLocalInputValue(new Date(value), MANUAL_ENTRY_TIME_ZONE);
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

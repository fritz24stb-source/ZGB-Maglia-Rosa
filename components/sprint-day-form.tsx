"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import {
  CICLAMINO_LOCATIONS,
  defaultSeasonWednesday,
  listSeasonWednesdays,
  type CiclaminoLocation,
} from "@/lib/classifications/ciclamino";
import { defaultCombativeVotingWindow } from "@/lib/date-time";

type ProfileOption = { id: string; displayName: string };
type SeasonOption = {
  endsOn: string;
  id: string;
  isActive: boolean;
  name: string;
  startsOn: string;
};

export type SprintDayFormValue = {
  adminOverrideUserId: string;
  locations: {
    effectivePlacements: ({ displayName: string; source: "admin_override" | "member" } | null)[];
    name: CiclaminoLocation;
    overrideUserIds: (string | null)[];
  }[];
  seasonId: string;
  sprintDate: string;
  voteClosesAt: string;
  voteOpensAt: string;
};

export function SprintDayForm({
  isEditing = false,
  initialValue,
  profiles,
  seasons,
  today,
}: {
  isEditing?: boolean;
  initialValue: SprintDayFormValue;
  profiles: ProfileOption[];
  seasons: SeasonOption[];
  today: string;
}) {
  const [seasonId, setSeasonId] = useState(initialValue.seasonId);
  const [sprintDate, setSprintDate] = useState(initialValue.sprintDate);
  const [voteOpensAt, setVoteOpensAt] = useState(initialValue.voteOpensAt);
  const [voteClosesAt, setVoteClosesAt] = useState(initialValue.voteClosesAt);
  const season = seasons.find((candidate) => candidate.id === seasonId) ?? seasons[0];
  const wednesdays = season ? listSeasonWednesdays(season) : [];

  function selectSeason(nextSeasonId: string) {
    const nextSeason = seasons.find((candidate) => candidate.id === nextSeasonId);
    setSeasonId(nextSeasonId);
    selectSprintDate(nextSeason ? defaultSeasonWednesday(nextSeason, today) : "");
  }

  function selectSprintDate(nextSprintDate: string) {
    setSprintDate(nextSprintDate);
    if (!nextSprintDate) return;
    const defaults = defaultCombativeVotingWindow(nextSprintDate);
    setVoteOpensAt(defaults.opensAt);
    setVoteClosesAt(defaults.closesAt);
  }

  return (
    <form action="/api/ciclamino/sprints" method="post" className="grid gap-5">
      {isEditing ? (
        <>
          <input type="hidden" name="originalSeasonId" value={initialValue.seasonId} />
          <input type="hidden" name="originalSprintDate" value={initialValue.sprintDate} />
        </>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Saison">
          <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" name="seasonId" onChange={(event) => selectSeason(event.target.value)} required value={seasonId}>
            {seasons.map((option) => <option key={option.id} value={option.id}>{option.name}{option.isActive ? " (aktiv)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Mittwoch">
          <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" name="sprintDate" onChange={(event) => selectSprintDate(event.target.value)} required value={wednesdays.includes(sprintDate) ? sprintDate : ""}>
            <option value="" disabled>Mittwoch wählen</option>
            {wednesdays.map((wednesday) => <option key={wednesday} value={wednesday}>{formatWednesday(wednesday)}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {CICLAMINO_LOCATIONS.map((defaultLocation, locationIndex) => {
          const location = initialValue.locations[locationIndex];
          return (
            <fieldset key={defaultLocation} className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-4">
              <legend className="px-1 text-sm font-semibold text-fuchsia-950">Sprint {locationIndex + 1}</legend>
              <Field label="Ortschild">
                <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" defaultValue={location?.name ?? defaultLocation} name={`location${locationIndex}Name`} required>
                  {CICLAMINO_LOCATIONS.map((name) => <option key={name}>{name}</option>)}
                </select>
              </Field>
              <div className="mt-4 grid gap-3">
                {[1, 2, 3, 4, 5].map((place) => (
                  <Field key={place} label={`${place}. Platz (${6 - place} P)`}>
                    <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" defaultValue={location?.overrideUserIds[place - 1] ?? ""} name={`location${locationIndex}Place${place}UserId`}>
                      <option value="">Kein Override – Meldung verwenden</option>
                      {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
                    </select>
                    <span className="text-xs font-normal text-asphalt-600">
                      {formatEffectivePlacement(location?.effectivePlacements[place - 1])}
                    </span>
                  </Field>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <fieldset className="grid gap-4 rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-4 md:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-fuchsia-950">Abstimmungszeitraum Maglia Ciclamino</legend>
        <Field label="Abstimmung geöffnet ab">
          <input className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" name="voteOpensAt" onChange={(event) => setVoteOpensAt(event.target.value)} required type="datetime-local" value={voteOpensAt} />
        </Field>
        <Field label="Abstimmung geöffnet bis">
          <input className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" name="voteClosesAt" onChange={(event) => setVoteClosesAt(event.target.value)} required type="datetime-local" value={voteClosesAt} />
        </Field>
      </fieldset>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <Field label="Rennleitungs-Override Most Combative Rider (optional)">
          <select className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm" defaultValue={initialValue.adminOverrideUserId} name="combativeUserId">
            <option value="">Kein Override – Abstimmung entscheidet</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
          </select>
        </Field>
        <p className="mt-2 text-xs leading-5 text-amber-900">Nur verwenden, wenn Stimmen und erzielte Sprintpunkte keinen eindeutigen Sieger ergeben oder eine Korrektur erforderlich ist.</p>
      </div>

      <button className="focus-ring inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!sprintDate} type="submit">
        <Save aria-hidden className="h-4 w-4" />
        {isEditing ? "Overrides und Zeitraum speichern" : "Sprinttag konfigurieren"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">{label}{children}</label>;
}

function formatWednesday(value: string) {
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatEffectivePlacement(
  placement: { displayName: string; source: "admin_override" | "member" } | null | undefined,
) {
  if (!placement) return "Aktuell noch nicht belegt";
  return `Aktuell: ${placement.displayName} · ${placement.source === "admin_override" ? "Rennleitungs-Override" : "Mitgliedsmeldung"}`;
}

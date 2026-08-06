"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import {
  CICLAMINO_LOCATIONS,
  defaultSeasonWednesday,
  listSeasonWednesdays,
  type CiclaminoLocation,
} from "@/lib/classifications/ciclamino";

type ProfileOption = { id: string; displayName: string };
type SeasonOption = {
  endsOn: string;
  id: string;
  isActive: boolean;
  name: string;
  startsOn: string;
};

export type SprintDayFormValue = {
  combativeUserId: string;
  locations: { name: CiclaminoLocation; userIds: string[] }[];
  seasonId: string;
  sprintDate: string;
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
  const season = seasons.find((candidate) => candidate.id === seasonId) ?? seasons[0];
  const wednesdays = season ? listSeasonWednesdays(season) : [];

  function selectSeason(nextSeasonId: string) {
    const nextSeason = seasons.find((candidate) => candidate.id === nextSeasonId);
    setSeasonId(nextSeasonId);
    setSprintDate(nextSeason ? defaultSeasonWednesday(nextSeason, today) : "");
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
          <select
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm"
            name="seasonId"
            onChange={(event) => selectSeason(event.target.value)}
            required
            value={seasonId}
          >
            {seasons.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}{option.isActive ? " (aktiv)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mittwoch">
          <select
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm"
            name="sprintDate"
            onChange={(event) => setSprintDate(event.target.value)}
            required
            value={wednesdays.includes(sprintDate) ? sprintDate : ""}
          >
            <option value="" disabled>Mittwoch wählen</option>
            {wednesdays.map((wednesday) => (
              <option key={wednesday} value={wednesday}>{formatWednesday(wednesday)}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {CICLAMINO_LOCATIONS.map((defaultLocation, locationIndex) => {
          const location = initialValue.locations[locationIndex];
          return (
            <fieldset key={defaultLocation} className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-4">
              <legend className="px-1 text-sm font-semibold text-fuchsia-950">
                Sprint {locationIndex + 1}
              </legend>
              <Field label="Ortschild">
                <select
                  className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm"
                  defaultValue={location?.name ?? defaultLocation}
                  name={`location${locationIndex}Name`}
                  required
                >
                  {CICLAMINO_LOCATIONS.map((name) => <option key={name}>{name}</option>)}
                </select>
              </Field>
              <div className="mt-4 grid gap-3">
                {[1, 2, 3, 4, 5].map((place) => (
                  <Field key={place} label={`${place}. Platz (${6 - place} P)`}>
                    <select
                      className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm"
                      defaultValue={location?.userIds[place - 1] ?? ""}
                      name={`location${locationIndex}Place${place}UserId`}
                      required
                    >
                      <option value="" disabled>Mitglied wählen</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.displayName}</option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-4">
        <Field label="Most Combative Rider (5 Extrapunkte)">
          <select
            className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm"
            defaultValue={initialValue.combativeUserId}
            name="combativeUserId"
            required
          >
            <option value="" disabled>Mitglied wählen</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.displayName}</option>
            ))}
          </select>
        </Field>
      </div>

      <button
        className="focus-ring inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={profiles.length < 5 || !sprintDate}
        type="submit"
      >
        <Save aria-hidden className="h-4 w-4" />
        {isEditing ? "Alle drei Sprints aktualisieren" : "Alle drei Sprints speichern"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">{label}{children}</label>;
}

function formatWednesday(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

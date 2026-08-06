export const CICLAMINO_LOCATIONS = [
  "Okel",
  "Heiligenfelde I",
  "Heiligenfelde II",
] as const;

export type CiclaminoLocation = (typeof CICLAMINO_LOCATIONS)[number];

export type CiclaminoSeasonWindow = {
  endsOn: string;
  startsOn: string;
};

export function listSeasonWednesdays({
  startsOn,
  endsOn,
}: CiclaminoSeasonWindow) {
  const first = parseDate(startsOn);
  const end = parseDate(endsOn);
  const daysUntilWednesday = (3 - isoWeekday(first) + 7) % 7;
  first.setUTCDate(first.getUTCDate() + daysUntilWednesday);

  const values: string[] = [];
  for (const date = first; date <= end; date.setUTCDate(date.getUTCDate() + 7)) {
    values.push(formatDate(date));
  }
  return values;
}

export function defaultSeasonWednesday(
  season: CiclaminoSeasonWindow,
  today = todayInZurich(),
) {
  const wednesdays = listSeasonWednesdays(season);
  if (wednesdays.length === 0) return "";

  return (
    [...wednesdays].reverse().find((wednesday) => wednesday <= today) ??
    wednesdays[0]
  );
}

export function todayInZurich(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Zurich",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isoWeekday(value: Date) {
  const weekday = value.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

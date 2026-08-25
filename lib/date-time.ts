const BERLIN_TIME_ZONE = "Europe/Berlin";

export function berlinLocalDateTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Ungültige lokale Datums- und Zeitangabe.");
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedParts(new Date(instant));
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    instant += desired - represented;
  }
  return new Date(instant).toISOString();
}

export function isoToBerlinLocalDateTime(value: string) {
  const parts = zonedParts(new Date(value));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function defaultCombativeVotingWindow(sprintDate: string) {
  const nextDate = new Date(`${sprintDate}T12:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 2);
  const tomorrow = nextDate.toISOString().slice(0, 10);
  return {
    closesAt: `${tomorrow}T18:00`,
    opensAt: `${sprintDate}T18:00`,
  };
}

function zonedParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: BERLIN_TIME_ZONE,
    year: "numeric",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    month: Number(map.month),
    year: Number(map.year),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

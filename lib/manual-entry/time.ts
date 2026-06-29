export const MANUAL_ENTRY_TIME_ZONE = "Europe/Berlin";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TimeOfDay = {
  hour: number;
  minute: number;
};

export type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
};

export type WeeklyWindowConfig = {
  weekdayStart: number;
  timeStart: TimeOfDay;
  weekdayEnd: number;
  timeEnd: TimeOfDay;
  timeZone?: string;
};

export type WindowStatus = {
  isOpen: boolean;
  opensAt: Date;
  closesAt: Date;
  nextOpensAt: Date | null;
  timeZone: string;
};

const weekdayNames: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function getWeeklyWindowStatus(
  config: WeeklyWindowConfig,
  referenceDate: Date,
): WindowStatus {
  const timeZone = config.timeZone ?? MANUAL_ENTRY_TIME_ZONE;
  let period = buildWeeklyPeriod(config, referenceDate, 0, timeZone);

  if (referenceDate < period.opensAt) {
    const previousPeriod = buildWeeklyPeriod(
      config,
      referenceDate,
      -1,
      timeZone,
    );

    if (
      referenceDate >= previousPeriod.opensAt &&
      referenceDate <= previousPeriod.closesAt
    ) {
      period = previousPeriod;
    }
  } else if (referenceDate > period.closesAt) {
    period = buildWeeklyPeriod(config, referenceDate, 1, timeZone);
  }

  const isOpen =
    referenceDate >= period.opensAt && referenceDate <= period.closesAt;
  const nextPeriod = isOpen
    ? buildPeriodFromStartLocalDate(
        config,
        period.startLocalDateUtc + 7 * DAY_MS,
        timeZone,
      )
    : period;

  return {
    isOpen,
    opensAt: period.opensAt,
    closesAt: period.closesAt,
    nextOpensAt: nextPeriod.opensAt,
    timeZone,
  };
}

export function getFixedWindowStatus(input: {
  opensAt: string | null;
  closesAt: string | null;
  referenceDate: Date;
  timeZone?: string;
}): WindowStatus | null {
  if (!input.opensAt || !input.closesAt) {
    return null;
  }

  const opensAt = new Date(input.opensAt);
  const closesAt = new Date(input.closesAt);

  if (
    Number.isNaN(opensAt.getTime()) ||
    Number.isNaN(closesAt.getTime()) ||
    closesAt < opensAt
  ) {
    return null;
  }

  const isOpen =
    input.referenceDate >= opensAt && input.referenceDate <= closesAt;

  return {
    isOpen,
    opensAt,
    closesAt,
    nextOpensAt: input.referenceDate < opensAt ? opensAt : null,
    timeZone: input.timeZone ?? MANUAL_ENTRY_TIME_ZONE,
  };
}

export function parseWeeklyRulePair(
  startsAtRule: string | null,
  endsAtRule: string | null,
): WeeklyWindowConfig | null {
  const start = parseWeeklyRule(startsAtRule);
  const end = parseWeeklyRule(endsAtRule);

  if (!start || !end || start.timeZone !== end.timeZone) {
    return null;
  }

  return {
    weekdayStart: start.weekday,
    timeStart: start.time,
    weekdayEnd: end.weekday,
    timeEnd: end.time,
    timeZone: start.timeZone,
  };
}

export function parseTimeOfDay(value: string): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

export function parseManualLocalDateTime(
  value: string,
  timeZone = MANUAL_ENTRY_TIME_ZONE,
): {
  parts: Required<LocalDateTimeParts>;
  utcDate: Date;
  localIsoWithOffset: string;
  localDate: string;
  inputValue: string;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour > 23 ||
    parts.minute > 59
  ) {
    return null;
  }

  const utcDate = zonedDateTimeToUtc(parts, timeZone);
  const roundTrip = getZonedDateTimeParts(utcDate, timeZone);

  if (
    roundTrip.year !== parts.year ||
    roundTrip.month !== parts.month ||
    roundTrip.day !== parts.day ||
    roundTrip.hour !== parts.hour ||
    roundTrip.minute !== parts.minute
  ) {
    return null;
  }

  return {
    parts,
    utcDate,
    localIsoWithOffset: formatLocalIsoWithOffset(parts, utcDate, timeZone),
    localDate: formatLocalDate(parts),
    inputValue: value.trim(),
  };
}

export function toLocalInputValue(
  date: Date,
  timeZone = MANUAL_ENTRY_TIME_ZONE,
) {
  const parts = getZonedDateTimeParts(date, timeZone);

  return [
    formatLocalDate(parts),
    `${pad(parts.hour)}:${pad(parts.minute)}`,
  ].join("T");
}

export function getLocalDateString(
  date: Date,
  timeZone = MANUAL_ENTRY_TIME_ZONE,
) {
  return formatLocalDate(getZonedDateTimeParts(date, timeZone));
}

export function getZonedDateTimeParts(
  date: Date,
  timeZone = MANUAL_ENTRY_TIME_ZONE,
): Required<LocalDateTimeParts> {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}

export function zonedDateTimeToUtc(
  parts: LocalDateTimeParts,
  timeZone = MANUAL_ENTRY_TIME_ZONE,
) {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0,
  );
  let utcMs =
    localAsUtc -
    getTimeZoneOffsetMinutes(new Date(localAsUtc), timeZone) * 60_000;

  for (let iteration = 0; iteration < 2; iteration += 1) {
    utcMs =
      localAsUtc - getTimeZoneOffsetMinutes(new Date(utcMs), timeZone) * 60_000;
  }

  return new Date(utcMs);
}

export function getIsoWeekdayForLocalDate(
  year: number,
  month: number,
  day: number,
) {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return jsDay === 0 ? 7 : jsDay;
}

function buildWeeklyPeriod(
  config: WeeklyWindowConfig,
  referenceDate: Date,
  shiftWeeks: number,
  timeZone: string,
) {
  const localParts = getZonedDateTimeParts(referenceDate, timeZone);
  const localDateUtc = Date.UTC(
    localParts.year,
    localParts.month - 1,
    localParts.day,
  );
  const referenceWeekday = getIsoWeekdayForLocalDate(
    localParts.year,
    localParts.month,
    localParts.day,
  );
  const startLocalDateUtc =
    localDateUtc +
    (config.weekdayStart - referenceWeekday + shiftWeeks * 7) * DAY_MS;

  return buildPeriodFromStartLocalDate(config, startLocalDateUtc, timeZone);
}

function buildPeriodFromStartLocalDate(
  config: WeeklyWindowConfig,
  startLocalDateUtc: number,
  timeZone: string,
) {
  const startParts = getUtcDateParts(startLocalDateUtc);
  const startWeekday = getIsoWeekdayForLocalDate(
    startParts.year,
    startParts.month,
    startParts.day,
  );
  let endLocalDateUtc =
    startLocalDateUtc + (config.weekdayEnd - startWeekday) * DAY_MS;

  if (
    endLocalDateUtc < startLocalDateUtc ||
    (endLocalDateUtc === startLocalDateUtc &&
      compareTimeOfDay(config.timeEnd, config.timeStart) < 0)
  ) {
    endLocalDateUtc += 7 * DAY_MS;
  }

  const endParts = getUtcDateParts(endLocalDateUtc);

  return {
    startLocalDateUtc,
    opensAt: zonedDateTimeToUtc(
      {
        ...startParts,
        hour: config.timeStart.hour,
        minute: config.timeStart.minute,
        second: 0,
      },
      timeZone,
    ),
    closesAt: zonedDateTimeToUtc(
      {
        ...endParts,
        hour: config.timeEnd.hour,
        minute: config.timeEnd.minute,
        second: 0,
      },
      timeZone,
    ),
  };
}

function parseWeeklyRule(value: string | null): {
  weekday: number;
  time: TimeOfDay;
  timeZone: string;
} | null {
  if (!value) {
    return null;
  }

  const parts = value.trim().split(":");

  if (parts.length < 5 || parts[0] !== "weekly") {
    return null;
  }

  const weekday = weekdayNames[parts[1].toLowerCase()];
  const time = parseTimeOfDay(`${parts[2]}:${parts[3]}`);
  const timeZone = parts.slice(4).join(":");

  if (!weekday || !time || !timeZone) {
    return null;
  }

  return { weekday, time, timeZone };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = getZonedDateTimeParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return Math.round((localAsUtc - date.getTime()) / 60_000);
}

function getUtcDateParts(dateUtcMs: number) {
  const date = new Date(dateUtcMs);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function compareTimeOfDay(left: TimeOfDay, right: TimeOfDay) {
  return left.hour * 60 + left.minute - (right.hour * 60 + right.minute);
}

function getFormatter(timeZone: string) {
  const existingFormatter = formatterCache.get(timeZone);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

function formatLocalIsoWithOffset(
  parts: Required<LocalDateTimeParts>,
  utcDate: Date,
  timeZone: string,
) {
  const offsetMinutes = getTimeZoneOffsetMinutes(utcDate, timeZone);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetRemainderMinutes = absoluteOffset % 60;

  return [
    `${formatLocalDate(parts)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(
      parts.second,
    )}`,
    `${sign}${pad(offsetHours)}:${pad(offsetRemainderMinutes)}`,
  ].join("");
}

function formatLocalDate(
  parts: Pick<LocalDateTimeParts, "year" | "month" | "day">,
) {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

import type { Database } from "@/types/database";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ScoringRuleRow = Database["public"]["Tables"]["scoring_rules"]["Row"];

export type AnalysisActivity = Pick<
  ActivityRow,
  | "activity_started_at"
  | "activity_started_local_at"
  | "category"
  | "matched_rule_id"
  | "matched_rule_name"
  | "user_id"
>;

export type AnalysisScoringRule = Pick<
  ScoringRuleRow,
  | "category"
  | "id"
  | "is_active"
  | "name"
  | "rule_type"
  | "valid_from"
  | "valid_until"
>;

export type RideAnalysisRow = {
  date: string;
  eventNames: string[];
  participantCount: number;
  scuolaCount: number;
  scuderiaCount: number;
  title: string;
  type: "wednesday" | "fondo" | "event";
  zugCount: number;
};

export type WednesdayParticipationPoint = {
  date: string;
  participantCount: number;
};

export type RideAnalysis = {
  eventRides: RideAnalysisRow[];
  fondoRides: RideAnalysisRow[];
  summary: {
    eventParticipantAverage: number;
    eventRideCount: number;
    fondoParticipantAverage: number;
    fondoRideCount: number;
    maxWednesdayParticipants: number;
    wednesdayParticipantAverage: number;
    wednesdayParticipationTotal: number;
    wednesdayRideCount: number;
  };
  wednesdayGraph: WednesdayParticipationPoint[];
  wednesdayRides: RideAnalysisRow[];
};

type RideAccumulator = {
  date: string;
  eventNames: Set<string>;
  participants: Set<string>;
  scuolaParticipants: Set<string>;
  scuderiaParticipants: Set<string>;
  title: string;
  type: RideAnalysisRow["type"];
  zugParticipants: Set<string>;
};

const ZGB_WEDNESDAY_CATEGORIES = new Set(["zug", "scuola", "scuderia"]);

export function buildRideAnalysis(
  activities: AnalysisActivity[],
  rules: AnalysisScoringRule[],
): RideAnalysis {
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const wednesdayByDate = new Map<string, RideAccumulator>();
  const fondoByDate = new Map<string, RideAccumulator>();
  const eventsByDate = new Map<string, RideAccumulator>();

  for (const activity of activities) {
    const date = getActivityDateKey(activity);

    if (!date) {
      continue;
    }

    if (isWednesdayGroupRide(activity)) {
      addActivityToRide(
        getRideAccumulator(wednesdayByDate, {
          date,
          title: "ZGB Zug",
          type: "wednesday",
        }),
        activity,
        rulesById,
        rules,
      );
    }

    if (activity.category === "fondo") {
      addActivityToRide(
        getRideAccumulator(fondoByDate, {
          date,
          title: "Samstags-Fondo",
          type: "fondo",
        }),
        activity,
        rulesById,
        rules,
      );
    }

    if (isSpecialEvent(activity, rulesById)) {
      addActivityToRide(
        getRideAccumulator(eventsByDate, {
          date,
          title: "Sonderevent",
          type: "event",
        }),
        activity,
        rulesById,
        rules,
      );
    }
  }

  const wednesdayRides = toSortedRideRows(wednesdayByDate, "desc");
  const fondoRides = toSortedRideRows(fondoByDate, "desc");
  const eventRides = toSortedRideRows(eventsByDate, "desc").map((ride) => ({
    ...ride,
    title: formatEventTitle(ride.eventNames),
  }));
  const wednesdayGraph = toSortedRideRows(wednesdayByDate, "asc").map(
    (ride) => ({
      date: ride.date,
      participantCount: ride.participantCount,
    }),
  );

  return {
    eventRides,
    fondoRides,
    summary: {
      eventParticipantAverage: averageParticipants(eventRides),
      eventRideCount: eventRides.length,
      fondoParticipantAverage: averageParticipants(fondoRides),
      fondoRideCount: fondoRides.length,
      maxWednesdayParticipants: Math.max(
        0,
        ...wednesdayGraph.map((ride) => ride.participantCount),
      ),
      wednesdayParticipantAverage: averageParticipants(wednesdayRides),
      wednesdayParticipationTotal: wednesdayGraph.reduce(
        (sum, ride) => sum + ride.participantCount,
        0,
      ),
      wednesdayRideCount: wednesdayRides.length,
    },
    wednesdayGraph,
    wednesdayRides,
  };
}

function averageParticipants(rides: RideAnalysisRow[]) {
  if (rides.length === 0) {
    return 0;
  }

  return (
    rides.reduce((sum, ride) => sum + ride.participantCount, 0) / rides.length
  );
}

function getRideAccumulator(
  ridesByDate: Map<string, RideAccumulator>,
  input: {
    date: string;
    title: string;
    type: RideAnalysisRow["type"];
  },
) {
  const existing = ridesByDate.get(input.date);

  if (existing) {
    return existing;
  }

  const created: RideAccumulator = {
    date: input.date,
    eventNames: new Set(),
    participants: new Set(),
    scuolaParticipants: new Set(),
    scuderiaParticipants: new Set(),
    title: input.title,
    type: input.type,
    zugParticipants: new Set(),
  };

  ridesByDate.set(input.date, created);

  return created;
}

function addActivityToRide(
  ride: RideAccumulator,
  activity: AnalysisActivity,
  rulesById: Map<string, AnalysisScoringRule>,
  rules: AnalysisScoringRule[],
) {
  ride.participants.add(activity.user_id);

  if (activity.category === "zug") {
    ride.zugParticipants.add(activity.user_id);
  }

  if (activity.category === "scuola") {
    ride.scuolaParticipants.add(activity.user_id);
  }

  if (activity.category === "scuderia") {
    ride.scuderiaParticipants.add(activity.user_id);
  }

  const eventName = getEventName(activity, rulesById, rules);

  if (eventName) {
    ride.eventNames.add(eventName);
  }
}

function toSortedRideRows(
  ridesByDate: Map<string, RideAccumulator>,
  direction: "asc" | "desc",
) {
  return [...ridesByDate.values()]
    .map(toRideRow)
    .sort((left, right) =>
      direction === "asc"
        ? left.date.localeCompare(right.date)
        : right.date.localeCompare(left.date),
    );
}

function toRideRow(ride: RideAccumulator): RideAnalysisRow {
  return {
    date: ride.date,
    eventNames: [...ride.eventNames].sort((left, right) =>
      left.localeCompare(right, "de"),
    ),
    participantCount: ride.participants.size,
    scuolaCount: ride.scuolaParticipants.size,
    scuderiaCount: ride.scuderiaParticipants.size,
    title: ride.title,
    type: ride.type,
    zugCount: ride.zugParticipants.size,
  };
}

function isWednesdayGroupRide(activity: AnalysisActivity) {
  return activity.category
    ? ZGB_WEDNESDAY_CATEGORIES.has(activity.category)
    : false;
}

function isSpecialEvent(
  activity: AnalysisActivity,
  rulesById: Map<string, AnalysisScoringRule>,
) {
  const rule = activity.matched_rule_id
    ? rulesById.get(activity.matched_rule_id)
    : null;

  return rule?.rule_type === "special" || activity.category === "sonderevent";
}

function isRuleEffectiveForActivity(
  rule: AnalysisScoringRule,
  activity: AnalysisActivity,
) {
  if (!rule.is_active) {
    return false;
  }

  const activityStartedAt = new Date(
    activity.activity_started_local_at ?? activity.activity_started_at,
  );
  const validFrom = rule.valid_from ? new Date(rule.valid_from) : null;
  const validUntil = rule.valid_until ? new Date(rule.valid_until) : null;

  if (
    Number.isNaN(activityStartedAt.getTime()) ||
    (validFrom && Number.isNaN(validFrom.getTime())) ||
    (validUntil && Number.isNaN(validUntil.getTime()))
  ) {
    return false;
  }

  return (
    (!validFrom || activityStartedAt >= validFrom) &&
    (!validUntil || activityStartedAt <= validUntil)
  );
}

function getEventName(
  activity: AnalysisActivity,
  rulesById: Map<string, AnalysisScoringRule>,
  rules: AnalysisScoringRule[],
) {
  if (!isSpecialEvent(activity, rulesById)) {
    return null;
  }

  const matchedRule = activity.matched_rule_id
    ? rulesById.get(activity.matched_rule_id)
    : null;
  const currentRule =
    matchedRule?.rule_type === "special" &&
    isRuleEffectiveForActivity(matchedRule, activity)
      ? matchedRule
      : rules.find(
          (rule) =>
            rule.rule_type === "special" &&
            isRuleEffectiveForActivity(rule, activity),
        );

  // Rules are the current source of truth for event names and validity.
  return currentRule?.name ?? "Sonderevent";
}

function formatEventTitle(eventNames: string[]) {
  if (eventNames.length === 0) {
    return "Sonderevent";
  }

  if (eventNames.length === 1) {
    return eventNames[0];
  }

  return `${eventNames[0]} + ${eventNames.length - 1} weitere`;
}

function getActivityDateKey(activity: AnalysisActivity) {
  if (activity.activity_started_local_at) {
    return extractIsoDate(activity.activity_started_local_at);
  }

  return formatBerlinDate(activity.activity_started_at);
}

function extractIsoDate(value: string) {
  const datePart = value.slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function formatBerlinDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Berlin",
    year: "numeric",
  }).format(date);
}

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
  "category" | "id" | "name" | "rule_type"
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

  const eventName = getEventName(activity, rulesById);

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

function getEventName(
  activity: AnalysisActivity,
  rulesById: Map<string, AnalysisScoringRule>,
) {
  if (!isSpecialEvent(activity, rulesById)) {
    return null;
  }

  const rule = activity.matched_rule_id
    ? rulesById.get(activity.matched_rule_id)
    : null;

  return activity.matched_rule_name ?? rule?.name ?? null;
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

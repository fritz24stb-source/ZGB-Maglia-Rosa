import type {
  ActivityScoreUpdate,
  ScorableActivity,
  ScoreResult,
  ScoringRuleRow,
} from "@/lib/scoring/types";

const NO_MATCH_REASON =
  "Keine aktive Scoring-Regel passt zu Aktivitaet, Datum, Sportart und Quelle.";
const INACTIVE_ACTIVITY_REASON =
  "Aktivitaet ist nicht aktiv und erhaelt 0 Punkte.";
const INVALID_DATE_REASON =
  "Aktivitaet hat keinen gueltigen Startzeitpunkt und erhaelt 0 Punkte.";
const INVALID_OVERRIDE_REASON =
  "Admin-Override verweist auf keine aktive passende Scoring-Regel.";

type ScoreOptions = {
  scoredAt?: Date;
};

type ActivityMatchContext = {
  activityDate: Date;
  isManual: boolean;
  isoWeekday: number | null;
  normalizedActivityName: string;
  normalizedSportType: string | null;
};

type KeywordCondition = {
  alternatives: string[];
  mode: "excluded" | "required";
};

const keywordConditionCache = new Map<string, KeywordCondition>();

export function scoreActivity(
  activity: ScorableActivity,
  rules: ScoringRuleRow[],
  options: ScoreOptions = {},
): ScoreResult {
  const scoredAt = (options.scoredAt ?? new Date()).toISOString();

  if (activity.status !== "active") {
    return buildNoScoreResult(INACTIVE_ACTIVITY_REASON, scoredAt);
  }

  const overrideRule = findScoringOverrideRule(activity, rules);

  if (activity.scoring_override_rule_id) {
    if (!overrideRule) {
      return buildNoScoreResult(INVALID_OVERRIDE_REASON, scoredAt);
    }

    return buildScoreResult(overrideRule, scoredAt, "Admin-Override");
  }

  const activityDate = parseTimestamp(
    activity.activity_started_local_at ?? activity.activity_started_at,
  );

  if (!activityDate) {
    return buildNoScoreResult(INVALID_DATE_REASON, scoredAt);
  }

  const matchContext = buildActivityMatchContext(activity, activityDate);
  const matchedRule = findBestMatchingRule(rules, activity, matchContext);

  if (!matchedRule) {
    return buildNoScoreResult(NO_MATCH_REASON, scoredAt);
  }

  return buildScoreResult(
    matchedRule,
    scoredAt,
    matchedRule.rule_type === "special" ? "Sonderevent" : "Standardregel",
  );
}

function buildScoreResult(
  rule: ScoringRuleRow,
  scoredAt: string,
  reasonPrefix: "Admin-Override" | "Sonderevent" | "Standardregel",
): ScoreResult {
  return {
    points: rule.points,
    category: rule.category,
    matchedRuleId: rule.id,
    matchedRuleName: rule.name,
    matchedCategory: rule.category,
    awardedPoints: rule.points,
    scoringReason: `${reasonPrefix} '${rule.name}' angewendet.`,
    scoredAt,
  };
}

export function toActivityScoreUpdate(
  result: ScoreResult,
): ActivityScoreUpdate {
  return {
    category: result.category,
    points: result.points,
    matched_rule_id: result.matchedRuleId,
    matched_rule_name: result.matchedRuleName,
    matched_category: result.matchedCategory,
    awarded_points: result.awardedPoints,
    scoring_reason: result.scoringReason,
    scored_at: result.scoredAt,
  };
}

export function isScoreResultScored(result: ScoreResult) {
  return result.matchedRuleId !== null && result.points > 0;
}

export function compareRulesForScoring(
  left: ScoringRuleRow,
  right: ScoringRuleRow,
) {
  if (left.rule_type !== right.rule_type) {
    return left.rule_type === "special" ? -1 : 1;
  }

  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  if (right.points !== left.points) {
    return right.points - left.points;
  }

  return left.name.localeCompare(right.name, "de");
}

export function ruleMatchesActivity(
  rule: ScoringRuleRow,
  activity: ScorableActivity,
  activityDate = parseTimestamp(
    activity.activity_started_local_at ?? activity.activity_started_at,
  ),
) {
  if (!activityDate) {
    return false;
  }

  return ruleMatchesActivityWithContext(
    rule,
    activity,
    buildActivityMatchContext(activity, activityDate),
  );
}

function findBestMatchingRule(
  rules: ScoringRuleRow[],
  activity: ScorableActivity,
  context: ActivityMatchContext,
) {
  let bestRule: ScoringRuleRow | null = null;

  for (const rule of rules) {
    if (!ruleMatchesActivityWithContext(rule, activity, context)) {
      continue;
    }

    if (!bestRule || compareRulesForScoring(rule, bestRule) < 0) {
      bestRule = rule;
    }
  }

  return bestRule;
}

function ruleMatchesActivityWithContext(
  rule: ScoringRuleRow,
  activity: ScorableActivity,
  context: ActivityMatchContext,
) {
  if (!rule.is_active) {
    return false;
  }

  if (rule.season_id && rule.season_id !== activity.season_id) {
    return false;
  }

  if (context.isManual && !rule.manual_entry_allowed) {
    return false;
  }

  return (
    matchesNameKeywords(rule.name_keywords, context.normalizedActivityName) &&
    matchesWeekday(rule.allowed_weekdays, context.isoWeekday) &&
    matchesValidityWindow(rule, context.activityDate) &&
    matchesSportType(rule.allowed_sport_types, context.normalizedSportType) &&
    matchesMinimumDistance(rule.min_distance_m, activity.distance_m)
  );
}

function buildNoScoreResult(reason: string, scoredAt: string): ScoreResult {
  return {
    points: 0,
    category: null,
    matchedRuleId: null,
    matchedRuleName: null,
    matchedCategory: null,
    awardedPoints: 0,
    scoringReason: reason,
    scoredAt,
  };
}

function findScoringOverrideRule(
  activity: ScorableActivity,
  rules: ScoringRuleRow[],
) {
  if (!activity.scoring_override_rule_id) {
    return null;
  }

  return (
    rules.find(
      (rule) =>
        rule.id === activity.scoring_override_rule_id &&
        rule.is_active &&
        (!rule.season_id || rule.season_id === activity.season_id),
    ) ?? null
  );
}

function isManualActivity(activity: ScorableActivity) {
  return activity.source === "manual" || activity.manually_entered;
}

function buildActivityMatchContext(
  activity: ScorableActivity,
  activityDate: Date,
): ActivityMatchContext {
  const timestamp =
    activity.activity_started_local_at ?? activity.activity_started_at;

  return {
    activityDate,
    isManual: isManualActivity(activity),
    isoWeekday: getIsoWeekdayFromTimestamp(timestamp),
    normalizedActivityName: normalizeForMatch(activity.activity_name),
    normalizedSportType: activity.sport_type
      ? normalizeForMatch(activity.sport_type)
      : null,
  };
}

function matchesNameKeywords(
  keywords: string[],
  normalizedActivityName: string,
) {
  const keywordConditions = keywords
    .map(getKeywordCondition)
    .filter((condition) => condition.alternatives.length > 0);

  if (
    keywordConditions.length === 0 ||
    !keywordConditions.some((condition) => condition.mode === "required")
  ) {
    return false;
  }

  return keywordConditions.every((condition) => {
    if (condition.mode === "excluded") {
      return condition.alternatives.every(
        (keyword) => !normalizedActivityName.includes(keyword),
      );
    }

    return condition.alternatives.some((keyword) =>
      normalizedActivityName.includes(keyword),
    );
  });
}

function getKeywordCondition(keyword: string): KeywordCondition {
  const cachedCondition = keywordConditionCache.get(keyword);

  if (cachedCondition) {
    return cachedCondition;
  }

  const condition = parseKeywordCondition(keyword);
  keywordConditionCache.set(keyword, condition);

  return condition;
}

function parseKeywordCondition(keyword: string): KeywordCondition {
  const trimmed = keyword.trim();
  const excludedMatch = /^(?:!\s*|kein\s+)(.+)$/i.exec(trimmed);
  const rawAlternatives = excludedMatch ? excludedMatch[1] : trimmed;

  return {
    alternatives: rawAlternatives
      .split(/\s*(?:\||\boder\b)\s*/i)
      .map((alternative) => normalizeForMatch(alternative))
      .filter(Boolean),
    mode: excludedMatch ? "excluded" : "required",
  };
}

function matchesWeekday(
  allowedWeekdays: number[] | null,
  isoWeekday: number | null,
) {
  if (!allowedWeekdays || allowedWeekdays.length === 0) {
    return true;
  }

  return isoWeekday !== null && allowedWeekdays.includes(isoWeekday);
}

function matchesValidityWindow(rule: ScoringRuleRow, activityDate: Date) {
  const validFrom = parseTimestamp(rule.valid_from);
  const validUntil = parseTimestamp(rule.valid_until);

  if (rule.valid_from && !validFrom) {
    return false;
  }

  if (rule.valid_until && !validUntil) {
    return false;
  }

  if (validFrom && activityDate < validFrom) {
    return false;
  }

  if (validUntil && activityDate > validUntil) {
    return false;
  }

  return true;
}

function matchesSportType(
  allowedSportTypes: string[] | null,
  normalizedSportType: string | null,
) {
  if (!allowedSportTypes || allowedSportTypes.length === 0) {
    return true;
  }

  if (!normalizedSportType) {
    return false;
  }

  for (const allowedSportType of allowedSportTypes) {
    if (normalizeForMatch(allowedSportType) === normalizedSportType) {
      return true;
    }
  }

  return false;
}

function matchesMinimumDistance(
  minDistanceM: number | null,
  distanceM: number | null,
) {
  if (minDistanceM === null) {
    return true;
  }

  return distanceM !== null && distanceM >= minDistanceM;
}

function parseTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getIsoWeekdayFromTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  const datePartMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(timestamp);

  if (datePartMatch) {
    const [, year, month, day] = datePartMatch;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    return convertJsDayToIsoWeekday(date.getUTCDay());
  }

  const parsedDate = parseTimestamp(timestamp);

  if (!parsedDate) {
    return null;
  }

  return convertJsDayToIsoWeekday(parsedDate.getUTCDay());
}

function convertJsDayToIsoWeekday(jsDay: number) {
  return jsDay === 0 ? 7 : jsDay;
}

function normalizeForMatch(value: string) {
  return value.trim().toLocaleLowerCase("de");
}

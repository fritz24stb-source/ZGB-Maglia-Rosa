import { compareRulesForScoring } from "@/lib/scoring";
import {
  MANUAL_ENTRY_TIME_ZONE,
  getFixedWindowStatus,
  getWeeklyWindowStatus,
  parseTimeOfDay,
  parseWeeklyRulePair,
  type WeeklyWindowConfig,
  type WindowStatus,
} from "@/lib/manual-entry/time";
import type {
  ManualEntryContext,
  ManualEntryOption,
  ManualEntryWindowRow,
  ScoringRuleRow,
} from "@/lib/manual-entry/types";

type BuildManualEntryContextsInput = {
  rules: ScoringRuleRow[];
  windows: ManualEntryWindowRow[];
  existingEntryCounts: Map<string, number>;
  now: Date;
};

const categoryLabels: Record<string, string> = {
  fondo: "Samstags-Fondo",
  zgb_zug: "ZGB Zug",
  scuola: "Scuola",
  scuderia: "Scuderia",
  sonderevent: "Sonderevent",
};

export function buildManualEntryContexts({
  existingEntryCounts,
  now,
  rules,
  windows,
}: BuildManualEntryContextsInput): ManualEntryContext[] {
  const contexts: ManualEntryContext[] = [];
  const usedRuleIds = new Set<string>();
  const manualRules = rules
    .filter((rule) => rule.is_active && rule.manual_entry_allowed)
    .sort(compareRulesForScoring);

  for (const window of windows.filter((row) => row.active)) {
    const rule = manualRules.find(
      (candidate) =>
        candidate.rule_type === "standard" &&
        candidate.category === window.category,
    );
    const windowConfig = windowRowToWeeklyConfig(window);

    if (!rule || !windowConfig) {
      continue;
    }

    const windowStatus = getWeeklyWindowStatus(windowConfig, now);

    contexts.push(
      buildContext({
        existingEntryCounts,
        keyScope: `category:${rule.category}`,
        now,
        rule,
        usedRuleIds,
        windowStatus,
      }),
    );
  }

  for (const rule of manualRules) {
    if (usedRuleIds.has(rule.id)) {
      continue;
    }

    const windowStatus = getRuleWindowStatus(rule, now);

    if (!windowStatus) {
      continue;
    }

    contexts.push(
      buildContext({
        existingEntryCounts,
        keyScope:
          rule.rule_type === "special"
            ? `rule:${rule.id}`
            : `category:${rule.category}`,
        now,
        rule,
        usedRuleIds,
        windowStatus,
      }),
    );
  }

  return contexts.sort(compareManualEntryContexts);
}

export function getNextManualEntryOpening(
  options: Pick<ManualEntryOption, "nextOpensAt">[],
) {
  return (
    options
      .map((option) => option.nextOpensAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null
  );
}

export function getManualEntryLabel(rule: ScoringRuleRow) {
  return categoryLabels[rule.category] ?? rule.name;
}

function buildContext(input: {
  existingEntryCounts: Map<string, number>;
  keyScope: string;
  now: Date;
  rule: ScoringRuleRow;
  usedRuleIds: Set<string>;
  windowStatus: WindowStatus;
}): ManualEntryContext {
  input.usedRuleIds.add(input.rule.id);

  const manualEntryKey = `${input.keyScope}:${input.windowStatus.opensAt.toISOString()}`;
  const existingEntries = input.existingEntryCounts.get(manualEntryKey) ?? 0;
  const maxEntries = Math.min(input.rule.max_manual_entries_per_user, 1);
  const remainingEntries = Math.max(maxEntries - existingEntries, 0);
  const status = getOptionStatus(input.windowStatus.isOpen, remainingEntries);

  return {
    ruleId: input.rule.id,
    category: input.rule.category,
    label: getManualEntryLabel(input.rule),
    points: input.rule.points,
    ruleType: input.rule.rule_type,
    status,
    opensAt: input.windowStatus.opensAt.toISOString(),
    closesAt: input.windowStatus.closesAt.toISOString(),
    nextOpensAt:
      input.windowStatus.nextOpensAt?.toISOString() ??
      (input.windowStatus.isOpen
        ? null
        : input.windowStatus.opensAt.toISOString()),
    maxEntries,
    existingEntries,
    remainingEntries,
    unavailableReason: getUnavailableReason(status),
    manualEntryKey,
    rule: input.rule,
    timeZone: input.windowStatus.timeZone,
  };
}

function getRuleWindowStatus(rule: ScoringRuleRow, now: Date) {
  const weeklyConfig = parseWeeklyRulePair(
    rule.manual_entry_valid_from_rule,
    rule.manual_entry_valid_until_rule,
  );

  if (weeklyConfig) {
    return getWeeklyWindowStatus(weeklyConfig, now);
  }

  if (rule.rule_type !== "special") {
    return null;
  }

  return getFixedWindowStatus({
    opensAt: rule.valid_from,
    closesAt: rule.valid_until,
    referenceDate: now,
    timeZone: MANUAL_ENTRY_TIME_ZONE,
  });
}

function windowRowToWeeklyConfig(
  window: ManualEntryWindowRow,
): WeeklyWindowConfig | null {
  const timeStart = parseTimeOfDay(window.time_start);
  const timeEnd = parseTimeOfDay(window.time_end);

  if (!timeStart || !timeEnd) {
    return null;
  }

  return {
    weekdayStart: window.weekday_start,
    timeStart,
    weekdayEnd: window.weekday_end,
    timeEnd,
    timeZone: MANUAL_ENTRY_TIME_ZONE,
  };
}

function getOptionStatus(
  isWindowOpen: boolean,
  remainingEntries: number,
): ManualEntryOption["status"] {
  if (!isWindowOpen) {
    return "closed";
  }

  return remainingEntries > 0 ? "open" : "used";
}

function getUnavailableReason(status: ManualEntryOption["status"]) {
  switch (status) {
    case "closed":
      return "Zeitfenster geschlossen.";
    case "used":
      return "Eintrag fuer dieses Zeitfenster bereits vorhanden.";
    case "open":
      return null;
  }
}

function compareManualEntryContexts(
  left: ManualEntryContext,
  right: ManualEntryContext,
) {
  if (left.status !== right.status) {
    return statusRank(left.status) - statusRank(right.status);
  }

  return (
    left.opensAt.localeCompare(right.opensAt) ||
    left.label.localeCompare(right.label, "de")
  );
}

function statusRank(status: ManualEntryOption["status"]) {
  switch (status) {
    case "open":
      return 0;
    case "used":
      return 1;
    case "closed":
      return 2;
  }
}

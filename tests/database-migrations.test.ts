import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260625162000_initial_schema_rls.sql",
  ),
  "utf8",
);
const seedSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260625163000_seed_standard_rules.sql",
  ),
  "utf8",
);
const phase4Sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260626092000_add_activity_distance.sql",
  ),
  "utf8",
);
const publicLeaderboardSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260629094359_public_leaderboard_access.sql",
  ),
  "utf8",
);
const scoredActivitiesOnlySql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260629152000_scored_activities_only.sql",
  ),
  "utf8",
);
const scoringOverridesSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260630100000_activity_scoring_overrides.sql",
  ),
  "utf8",
);
const standardKeywordLogicSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260630160000_update_standard_scoring_keyword_logic.sql",
  ),
  "utf8",
);
const zugCategorySql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260630170000_replace_zgb_zug_with_zug.sql",
  ),
  "utf8",
);
const stravaRetentionSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260707160000_strava_data_retention.sql",
  ),
  "utf8",
);
const memberPointAdjustmentsSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260721120000_member_point_adjustments.sql",
  ),
  "utf8",
);
const dailyScoringLimitSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260723110000_limit_one_scored_activity_per_day.sql",
  ),
  "utf8",
);
const longestDailyActivitySql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260806100000_keep_longest_scored_activity_per_member_day.sql",
  ),
  "utf8",
);
const classificationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260804190000_add_ciclamino_azzurra_classifications.sql",
  ),
  "utf8",
);
const expandedCiclaminoSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260806150000_expand_ciclamino_race_days.sql",
  ),
  "utf8",
);
const combativeAwardsSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260806170000_add_ciclamino_combative_awards.sql",
  ),
  "utf8",
);
const combativeVotingSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260806190000_add_ciclamino_combative_voting.sql",
  ),
  "utf8",
);
const memberResultsSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260806210000_expand_ciclamino_member_results.sql",
  ),
  "utf8",
);
const scheduledSprintDaysSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260806230000_schedule_ciclamino_sprint_days.sql",
  ),
  "utf8",
);

describe("database migrations", () => {
  it("enables RLS on all application tables", () => {
    const tables = [
      "profiles",
      "strava_connections",
      "seasons",
      "scoring_rules",
      "activities",
      "manual_entry_windows",
      "admin_notifications",
      "webhook_events",
      "audit_log",
    ];

    for (const table of tables) {
      expect(schemaSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("protects Strava token columns from authenticated client selects", () => {
    expect(schemaSql).toContain(
      "revoke all on table public.strava_connections",
    );
    expect(schemaSql).toContain(
      "grant select (id, user_id, strava_athlete_id, expires_at, scope, revoked, created_at, updated_at)",
    );
    expect(schemaSql).not.toContain("grant select (access_token");
    expect(schemaSql).not.toContain("grant select (refresh_token");
  });

  it("defines idempotency and leaderboard primitives", () => {
    expect(schemaSql).toContain(
      "create unique index activities_strava_activity_id_unique_idx",
    );
    expect(schemaSql).toContain("constraint webhook_events_unique unique");
    expect(schemaSql).toContain(
      "create or replace function public.get_leaderboard",
    );
  });

  it("seeds the active test season and standard scoring rules", () => {
    expect(seedSql).toContain("Test-Saison 2026");
    expect(seedSql).toContain("Samstags-Fondo");
    expect(seedSql).toContain("ZGB Zug");
    expect(seedSql).toContain("Scuola");
    expect(seedSql).toContain("Scuderia");
  });

  it("stores activity distance for distance-based scoring rules", () => {
    expect(phase4Sql).toContain("add column distance_m numeric");
    expect(phase4Sql).toContain("activities_distance_m_check");
  });

  it("allows public leaderboard reads without a user session", () => {
    expect(publicLeaderboardSql).toContain(
      "create or replace function public.get_leaderboard",
    );
    expect(publicLeaderboardSql).not.toContain("auth.uid()");
    expect(publicLeaderboardSql).toContain(
      "to anon, authenticated, service_role;",
    );
  });

  it("keeps only scored active activities in the leaderboard", () => {
    expect(scoredActivitiesOnlySql).not.toContain(
      "delete from public.activities",
    );
    expect(scoredActivitiesOnlySql).toContain("and a.status = 'active'");
    expect(scoredActivitiesOnlySql).toContain("and a.points > 0");
    expect(scoredActivitiesOnlySql).toContain(
      "join public.scoring_rules sr on sr.id = a.matched_rule_id",
    );
  });

  it("stores admin scoring overrides separately from automatic matches", () => {
    expect(scoringOverridesSql).toContain(
      "add column if not exists scoring_override_rule_id uuid",
    );
    expect(scoringOverridesSql).toContain(
      "references public.scoring_rules(id) on delete set null",
    );
  });

  it("updates standard rules for OR and exclusion keyword logic", () => {
    expect(standardKeywordLogicSql).toContain("fondo oder samstags");
    expect(standardKeywordLogicSql).toContain("zgb oder zug");
    expect(standardKeywordLogicSql).toContain("zgb oder scuola");
    expect(standardKeywordLogicSql).toContain("zgb oder scuderia");
    expect(standardKeywordLogicSql).toContain("kein zug");
    expect(standardKeywordLogicSql).toContain("kein scuola");
    expect(standardKeywordLogicSql).toContain("kein scuderia");
  });

  it("replaces the legacy zgb_zug category with zug", () => {
    expect(zugCategorySql).toContain("category = 'zug'");
    expect(zugCategorySql).toContain("category = 'zgb_zug'");
    expect(zugCategorySql).toContain("matched_category = 'zgb_zug'");
    expect(zugCategorySql).toContain(
      "where filtered.category in ('zug', 'scuola', 'scuderia')",
    );
    expect(zugCategorySql).not.toContain(
      "where filtered.category in ('zgb_zug', 'scuola', 'scuderia')",
    );
  });

  it("supports Strava detail erasure while retaining aggregate scoring rows", () => {
    expect(stravaRetentionSql).toContain(
      "alter column refresh_token drop not null",
    );
    expect(stravaRetentionSql).toContain(
      "add column if not exists strava_erased_at timestamptz",
    );
    expect(stravaRetentionSql).toContain("or strava_erased_at is not null");
  });

  it("stores season-based point corrections and adds them to unfiltered rankings", () => {
    expect(memberPointAdjustmentsSql).toContain(
      "create table public.member_point_adjustments",
    );
    expect(memberPointAdjustmentsSql).toContain(
      "primary key (user_id, season_id)",
    );
    expect(memberPointAdjustmentsSql).toContain(
      "coalesce(activity.activity_points, 0) + coalesce(adjustment.points, 0)",
    );
    expect(memberPointAdjustmentsSql).toContain(
      "and (p_category is null or p_category = 'all')",
    );
    expect(memberPointAdjustmentsSql).toContain("and p_from is null");
    expect(memberPointAdjustmentsSql).toContain("and p_to is null");
  });

  it("counts only the latest scored activity for each member and local day", () => {
    expect(dailyScoringLimitSql).toContain(
      "partition by\n          a.user_id,",
    );
    expect(dailyScoringLimitSql).toContain(
      "at time zone 'Europe/Berlin')::date",
    );
    expect(dailyScoringLimitSql).toContain(
      "coalesce(a.uploaded_or_created_at, a.created_at) desc",
    );
    expect(dailyScoringLimitSql).toContain("where a.daily_score_order = 1");

    const dailySelectionPosition = dailyScoringLimitSql.indexOf(
      "where a.daily_score_order = 1",
    );
    const categoryFilterPosition = dailyScoringLimitSql.indexOf(
      "and (p_category is null",
    );

    expect(dailySelectionPosition).toBeGreaterThan(-1);
    expect(categoryFilterPosition).toBeGreaterThan(dailySelectionPosition);
  });

  it("keeps only the longest scored activity for each member and local day", () => {
    expect(longestDailyActivitySql).toContain(
      "enforce_longest_scored_activity_per_member_day",
    );
    expect(longestDailyActivitySql).toContain("a.distance_m desc nulls last");
    expect(longestDailyActivitySql).toContain("points = 0");
    expect(longestDailyActivitySql).toContain("daily_score_order > 1");
  });
  it("adds isolated Ciclamino and Azzurra classifications", () => {
    expect(classificationSql).toContain("'admin', 'member', 'scorekeeper'");
    expect(classificationSql).toContain("create table public.ciclamino_sprints");
    expect(classificationSql).toContain("create table public.ciclamino_placements");
    expect(classificationSql).toContain("create table public.azzurra_windows");
    expect(classificationSql).toContain("add column if not exists total_elevation_gain_m numeric");
    expect(classificationSql).toContain("when 1 then 5");
    expect(classificationSql).toContain("when 2 then 3");
    expect(classificationSql).toContain("when 3 then 1");
    expect(classificationSql).toContain("activity.sport_type in ('Ride', 'GravelRide', 'MountainBikeRide')");
    expect(classificationSql).toContain("azzurra_window.starts_on + 6");
    expect(classificationSql).not.toContain("azzurra_windows window");
    expect(classificationSql).toContain("public.get_ciclamino_leaderboard");
    expect(classificationSql).toContain("public.get_azzurra_leaderboard");
  });

  it("stores complete Ciclamino race days with three locations and five places", () => {
    expect(expandedCiclaminoSql).toContain("public.save_ciclamino_race_day");
    expect(expandedCiclaminoSql).toContain("jsonb_array_length(p_sprints) <> 3");
    expect(expandedCiclaminoSql).toContain("jsonb_array_length(sprint_input -> 'userIds') <> 5");
    expect(expandedCiclaminoSql).toContain("'Okel', 'Heiligenfelde I', 'Heiligenfelde II'");
    expect(expandedCiclaminoSql).toContain("extract(isodow from new.sprint_date) <> 3");
    expect(expandedCiclaminoSql).toContain("when 2 then 4");
    expect(expandedCiclaminoSql).toContain("when 4 then 2");
    expect(expandedCiclaminoSql).toContain("when 5 then 1");
    expect(expandedCiclaminoSql).toContain("fourth_places bigint");
    expect(expandedCiclaminoSql).toContain("fifth_places bigint");
  });

  it("awards five extra Ciclamino points to one Most Combative Rider per race day", () => {
    expect(combativeAwardsSql).toContain("create table public.ciclamino_combative_awards");
    expect(combativeAwardsSql).toContain("primary key (season_id, sprint_date)");
    expect(combativeAwardsSql).toContain("points smallint not null default 5 check (points = 5)");
    expect(combativeAwardsSql).toContain("p_combative_user_id uuid");
    expect(combativeAwardsSql).toContain("combative_awards bigint");
    expect(combativeAwardsSql).toContain("coalesce(award.award_points, 0)");
  });

  it("stores changeable votes and resolves ties using sprint points", () => {
    expect(combativeVotingSql).toContain("create table public.ciclamino_combative_voting_windows");
    expect(combativeVotingSql).toContain("create table public.ciclamino_combative_votes");
    expect(combativeVotingSql).toContain("primary key (season_id, sprint_date, voter_user_id)");
    expect(combativeVotingSql).toContain("candidate.vote_count desc, candidate.sprint_points desc");
    expect(combativeVotingSql).toContain("having count(*) = 1");
    expect(combativeVotingSql).toContain("Europe/Berlin");
  });

  it("stores self-reported sprint results and applies position-specific admin overrides", () => {
    expect(memberResultsSql).toContain("create table public.ciclamino_result_submissions");
    expect(memberResultsSql).toContain("where place is not null");
    expect(memberResultsSql).toContain("create table public.ciclamino_placement_overrides");
    expect(memberResultsSql).toContain("public.save_ciclamino_member_vote");
    expect(memberResultsSql).toContain("public.refresh_ciclamino_effective_placements");
    expect(memberResultsSql).toContain("rider_override.user_id = submission.user_id");
  });

  it("creates every season Wednesday and publishes results only after voting closes", () => {
    expect(scheduledSprintDaysSql).toContain("public.ensure_ciclamino_sprint_days_for_season");
    expect(scheduledSprintDaysSql).toContain("extract(isodow from generated_day) = 3");
    expect(scheduledSprintDaysSql).toContain("create_ciclamino_sprint_days_after_season_insert");
    expect(scheduledSprintDaysSql).toContain("'Okel'");
    expect(scheduledSprintDaysSql).toContain("'Heiligenfelde I'");
    expect(scheduledSprintDaysSql).toContain("'Heiligenfelde II'");
    expect(scheduledSprintDaysSql).toContain("where voting_window.closes_at <= now()");
  });
});

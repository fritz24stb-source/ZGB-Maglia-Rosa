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
});

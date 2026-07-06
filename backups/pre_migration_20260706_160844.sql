


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_leaderboard"("p_season_id" "uuid" DEFAULT NULL::"uuid", "p_category" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT NULL::"text", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date", "p_member_id" "uuid" DEFAULT NULL::"uuid", "p_sport_type" "text" DEFAULT NULL::"text") RETURNS TABLE("place" integer, "user_id" "uuid", "display_name" "text", "season_id" "uuid", "season_name" "text", "total_points" integer, "total_rides" bigint, "samstags_fahrten" bigint, "mittwochs_fahrten" bigint, "sonderevents" bigint, "manual_points" integer, "last_activity_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with filtered as (
    select
      a.user_id,
      p.display_name,
      a.season_id,
      s.name as season_name,
      a.points,
      a.category,
      a.source,
      a.activity_started_local_at,
      a.activity_started_at,
      coalesce(sr.rule_type = 'special', false) as is_special
    from public.activities a
    join public.profiles p on p.id = a.user_id
    join public.seasons s on s.id = a.season_id
    join public.scoring_rules sr on sr.id = a.matched_rule_id
    where p.is_active
      and a.status = 'active'
      and a.points > 0
      and (p_season_id is null or a.season_id = p_season_id)
      and (p_category is null or p_category = 'all' or a.category = p_category)
      and (p_source is null or p_source = 'all' or a.source = p_source)
      and (p_member_id is null or a.user_id = p_member_id)
      and (p_sport_type is null or p_sport_type = 'all' or a.sport_type = p_sport_type)
      and (
        p_from is null
        or (coalesce(a.activity_started_local_at, a.activity_started_at) at time zone 'Europe/Berlin')::date >= p_from
      )
      and (
        p_to is null
        or (coalesce(a.activity_started_local_at, a.activity_started_at) at time zone 'Europe/Berlin')::date <= p_to
      )
  ),
  aggregated as (
    select
      filtered.user_id,
      filtered.display_name,
      filtered.season_id,
      filtered.season_name,
      coalesce(sum(filtered.points), 0)::integer as total_points,
      count(*)::bigint as total_rides,
      count(*) filter (where filtered.category = 'fondo')::bigint as samstags_fahrten,
      count(*) filter (
        where filtered.category in ('zug', 'scuola', 'scuderia')
      )::bigint as mittwochs_fahrten,
      count(*) filter (where filtered.is_special)::bigint as sonderevents,
      coalesce(sum(filtered.points) filter (where filtered.source = 'manual'), 0)::integer as manual_points,
      max(coalesce(filtered.activity_started_local_at, filtered.activity_started_at)) as last_activity_at
    from filtered
    group by filtered.user_id, filtered.display_name, filtered.season_id, filtered.season_name
  )
  select
    row_number() over (
      partition by aggregated.season_id
      order by
        aggregated.total_points desc,
        aggregated.total_rides desc,
        aggregated.samstags_fahrten desc,
        aggregated.display_name asc
    )::integer as place,
    aggregated.user_id,
    aggregated.display_name,
    aggregated.season_id,
    aggregated.season_name,
    aggregated.total_points,
    aggregated.total_rides,
    aggregated.samstags_fahrten,
    aggregated.mittwochs_fahrten,
    aggregated.sonderevents,
    aggregated.manual_points,
    aggregated.last_activity_at
  from aggregated
  order by place asc;
$$;


ALTER FUNCTION "public"."get_leaderboard"("p_season_id" "uuid", "p_category" "text", "p_source" "text", "p_from" "date", "p_to" "date", "p_member_id" "uuid", "p_sport_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "strava_activity_id" bigint,
    "source" "text" NOT NULL,
    "activity_name" "text" NOT NULL,
    "sport_type" "text",
    "activity_started_at" timestamp with time zone NOT NULL,
    "activity_started_local_at" timestamp with time zone,
    "uploaded_or_created_at" timestamp with time zone,
    "category" "text",
    "points" integer DEFAULT 0 NOT NULL,
    "matched_rule_id" "uuid",
    "matched_rule_name" "text",
    "matched_category" "text",
    "awarded_points" integer DEFAULT 0 NOT NULL,
    "scoring_reason" "text",
    "scored_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "manually_entered" boolean DEFAULT false NOT NULL,
    "manual_comment" "text",
    "manual_entry_key" "text",
    "strava_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "distance_m" numeric,
    "scoring_override_rule_id" "uuid",
    CONSTRAINT "activities_distance_m_check" CHECK ((("distance_m" IS NULL) OR ("distance_m" >= (0)::numeric))),
    CONSTRAINT "activities_name_not_blank" CHECK (("length"("btrim"("activity_name")) > 0)),
    CONSTRAINT "activities_points_check" CHECK ((("points" >= 0) AND ("awarded_points" >= 0))),
    CONSTRAINT "activities_source_check" CHECK (("source" = ANY (ARRAY['strava'::"text", 'manual'::"text"]))),
    CONSTRAINT "activities_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ignored'::"text", 'deleted'::"text"]))),
    CONSTRAINT "activities_strava_id_required" CHECK ((("source" = 'manual'::"text") OR ("strava_activity_id" IS NOT NULL)))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "user_id" "uuid",
    "activity_id" "uuid",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_notifications_message_not_blank" CHECK (("length"("btrim"("message")) > 0)),
    CONSTRAINT "admin_notifications_title_not_blank" CHECK (("length"("btrim"("title")) > 0)),
    CONSTRAINT "admin_notifications_type_not_blank" CHECK (("length"("btrim"("type")) > 0))
);


ALTER TABLE "public"."admin_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "before" "jsonb",
    "after" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_log_action_not_blank" CHECK (("length"("btrim"("action")) > 0)),
    CONSTRAINT "audit_log_entity_type_not_blank" CHECK (("length"("btrim"("entity_type")) > 0))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manual_entry_windows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "weekday_start" integer NOT NULL,
    "time_start" time without time zone NOT NULL,
    "weekday_end" integer NOT NULL,
    "time_end" time without time zone NOT NULL,
    "points" integer NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "manual_entry_windows_category_not_blank" CHECK (("length"("btrim"("category")) > 0)),
    CONSTRAINT "manual_entry_windows_points_positive" CHECK (("points" > 0)),
    CONSTRAINT "manual_entry_windows_weekday_end_check" CHECK ((("weekday_end" >= 1) AND ("weekday_end" <= 7))),
    CONSTRAINT "manual_entry_windows_weekday_start_check" CHECK ((("weekday_start" >= 1) AND ("weekday_start" <= 7)))
);


ALTER TABLE "public"."manual_entry_windows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_display_name_not_blank" CHECK (("length"("btrim"("display_name")) > 0)),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scoring_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "points" integer NOT NULL,
    "rule_type" "text" NOT NULL,
    "priority" integer NOT NULL,
    "name_keywords" "text"[] NOT NULL,
    "allowed_weekdays" integer[],
    "valid_from" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "min_distance_m" numeric,
    "allowed_sport_types" "text"[],
    "manual_entry_allowed" boolean DEFAULT false NOT NULL,
    "manual_entry_valid_from_rule" "text",
    "manual_entry_valid_until_rule" "text",
    "max_manual_entries_per_user" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scoring_rules_category_not_blank" CHECK (("length"("btrim"("category")) > 0)),
    CONSTRAINT "scoring_rules_keywords_not_empty" CHECK (("array_length"("name_keywords", 1) > 0)),
    CONSTRAINT "scoring_rules_manual_limit_check" CHECK (("max_manual_entries_per_user" > 0)),
    CONSTRAINT "scoring_rules_min_distance_check" CHECK ((("min_distance_m" IS NULL) OR ("min_distance_m" >= (0)::numeric))),
    CONSTRAINT "scoring_rules_name_not_blank" CHECK (("length"("btrim"("name")) > 0)),
    CONSTRAINT "scoring_rules_points_positive" CHECK (("points" > 0)),
    CONSTRAINT "scoring_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['standard'::"text", 'special'::"text"]))),
    CONSTRAINT "scoring_rules_valid_range_check" CHECK ((("valid_from" IS NULL) OR ("valid_until" IS NULL) OR ("valid_until" >= "valid_from"))),
    CONSTRAINT "scoring_rules_weekdays_valid" CHECK ((("allowed_weekdays" IS NULL) OR ("allowed_weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7])))
);


ALTER TABLE "public"."scoring_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "starts_on" "date" NOT NULL,
    "ends_on" "date" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "seasons_date_range_check" CHECK (("ends_on" >= "starts_on")),
    CONSTRAINT "seasons_name_not_blank" CHECK (("length"("btrim"("name")) > 0))
);


ALTER TABLE "public"."seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strava_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "strava_athlete_id" bigint NOT NULL,
    "access_token" "text",
    "refresh_token" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "scope" "text",
    "revoked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."strava_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "object_type" "text" NOT NULL,
    "object_id" bigint NOT NULL,
    "aspect_type" "text" NOT NULL,
    "owner_id" bigint NOT NULL,
    "event_time" timestamp with time zone NOT NULL,
    "raw_payload" "jsonb" NOT NULL,
    "processed_at" timestamp with time zone,
    "processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "processing_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "webhook_events_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'processed'::"text", 'ignored'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manual_entry_windows"
    ADD CONSTRAINT "manual_entry_windows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scoring_rules"
    ADD CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_athlete_unique" UNIQUE ("strava_athlete_id");



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_unique" UNIQUE ("object_type", "object_id", "aspect_type", "event_time");



CREATE INDEX "activities_distance_m_idx" ON "public"."activities" USING "btree" ("distance_m") WHERE (("status" = 'active'::"text") AND ("distance_m" IS NOT NULL));



CREATE UNIQUE INDEX "activities_manual_entry_key_unique_idx" ON "public"."activities" USING "btree" ("user_id", "season_id", "manual_entry_key") WHERE (("source" = 'manual'::"text") AND ("status" = 'active'::"text") AND ("manual_entry_key" IS NOT NULL));



CREATE INDEX "activities_matched_rule_id_idx" ON "public"."activities" USING "btree" ("matched_rule_id");



CREATE INDEX "activities_scoring_override_rule_id_idx" ON "public"."activities" USING "btree" ("scoring_override_rule_id");



CREATE INDEX "activities_season_category_source_idx" ON "public"."activities" USING "btree" ("season_id", "category", "source") WHERE ("status" = 'active'::"text");



CREATE INDEX "activities_season_user_active_idx" ON "public"."activities" USING "btree" ("season_id", "user_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "activities_started_local_idx" ON "public"."activities" USING "btree" ("activity_started_local_at") WHERE ("status" = 'active'::"text");



CREATE UNIQUE INDEX "activities_strava_activity_id_unique_idx" ON "public"."activities" USING "btree" ("strava_activity_id") WHERE ("strava_activity_id" IS NOT NULL);



CREATE INDEX "activities_user_id_idx" ON "public"."activities" USING "btree" ("user_id");



CREATE INDEX "admin_notifications_activity_id_idx" ON "public"."admin_notifications" USING "btree" ("activity_id");



CREATE INDEX "admin_notifications_unread_idx" ON "public"."admin_notifications" USING "btree" ("created_at" DESC) WHERE ("read_at" IS NULL);



CREATE INDEX "admin_notifications_user_id_idx" ON "public"."admin_notifications" USING "btree" ("user_id");



CREATE INDEX "audit_log_actor_user_id_idx" ON "public"."audit_log" USING "btree" ("actor_user_id");



CREATE INDEX "audit_log_entity_idx" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "scoring_rules_keywords_gin_idx" ON "public"."scoring_rules" USING "gin" ("name_keywords");



CREATE INDEX "scoring_rules_season_active_priority_idx" ON "public"."scoring_rules" USING "btree" ("season_id", "is_active", "priority" DESC);



CREATE INDEX "scoring_rules_sport_types_gin_idx" ON "public"."scoring_rules" USING "gin" ("allowed_sport_types") WHERE ("allowed_sport_types" IS NOT NULL);



CREATE INDEX "seasons_active_dates_idx" ON "public"."seasons" USING "btree" ("is_active", "starts_on", "ends_on");



CREATE UNIQUE INDEX "seasons_one_active_idx" ON "public"."seasons" USING "btree" ("is_active") WHERE "is_active";



CREATE INDEX "strava_connections_active_athlete_idx" ON "public"."strava_connections" USING "btree" ("strava_athlete_id") WHERE (NOT "revoked");



CREATE INDEX "strava_connections_user_id_idx" ON "public"."strava_connections" USING "btree" ("user_id");



CREATE INDEX "webhook_events_owner_status_idx" ON "public"."webhook_events" USING "btree" ("owner_id", "processing_status", "created_at" DESC);



CREATE OR REPLACE TRIGGER "set_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_manual_entry_windows_updated_at" BEFORE UPDATE ON "public"."manual_entry_windows" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_scoring_rules_updated_at" BEFORE UPDATE ON "public"."scoring_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_seasons_updated_at" BEFORE UPDATE ON "public"."seasons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_strava_connections_updated_at" BEFORE UPDATE ON "public"."strava_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_matched_rule_id_fkey" FOREIGN KEY ("matched_rule_id") REFERENCES "public"."scoring_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_scoring_override_rule_id_fkey" FOREIGN KEY ("scoring_override_rule_id") REFERENCES "public"."scoring_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scoring_rules"
    ADD CONSTRAINT "scoring_rules_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activities_admin_all" ON "public"."activities" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "activities_select_own_or_admin" ON "public"."activities" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_notifications_admin_all" ON "public"."admin_notifications" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_admin_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."manual_entry_windows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manual_entry_windows_admin_all" ON "public"."manual_entry_windows" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "manual_entry_windows_select_active_or_admin" ON "public"."manual_entry_windows" FOR SELECT TO "authenticated" USING (("active" OR "public"."is_admin"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_all" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "profiles_select_own_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."scoring_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scoring_rules_admin_all" ON "public"."scoring_rules" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "scoring_rules_select_active_or_admin" ON "public"."scoring_rules" FOR SELECT TO "authenticated" USING (("is_active" OR "public"."is_admin"()));



ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seasons_admin_all" ON "public"."seasons" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "seasons_select_authenticated" ON "public"."seasons" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."strava_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "strava_connections_select_own_or_admin" ON "public"."strava_connections" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_events_admin_select" ON "public"."webhook_events" FOR SELECT TO "authenticated" USING ("public"."is_admin"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."get_leaderboard"("p_season_id" "uuid", "p_category" "text", "p_source" "text", "p_from" "date", "p_to" "date", "p_member_id" "uuid", "p_sport_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_leaderboard"("p_season_id" "uuid", "p_category" "text", "p_source" "text", "p_from" "date", "p_to" "date", "p_member_id" "uuid", "p_sport_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_leaderboard"("p_season_id" "uuid", "p_category" "text", "p_source" "text", "p_from" "date", "p_to" "date", "p_member_id" "uuid", "p_sport_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leaderboard"("p_season_id" "uuid", "p_category" "text", "p_source" "text", "p_from" "date", "p_to" "date", "p_member_id" "uuid", "p_sport_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activities" TO "authenticated";



GRANT ALL ON TABLE "public"."admin_notifications" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."admin_notifications" TO "authenticated";



GRANT ALL ON TABLE "public"."audit_log" TO "service_role";
GRANT SELECT ON TABLE "public"."audit_log" TO "authenticated";



GRANT ALL ON TABLE "public"."manual_entry_windows" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."manual_entry_windows" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."scoring_rules" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."scoring_rules" TO "authenticated";



GRANT ALL ON TABLE "public"."seasons" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."seasons" TO "authenticated";



GRANT ALL ON TABLE "public"."strava_connections" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("strava_athlete_id") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("expires_at") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("scope") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("revoked") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";
GRANT SELECT ON TABLE "public"."webhook_events" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































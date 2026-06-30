export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ProfileRow = {
  id: string;
  display_name: string;
  role: "admin" | "member";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StravaConnectionRow = {
  id: string;
  user_id: string;
  strava_athlete_id: number;
  access_token: string | null;
  refresh_token: string;
  expires_at: string | null;
  scope: string | null;
  revoked: boolean;
  created_at: string;
  updated_at: string;
};

type SeasonRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ScoringRuleRow = {
  id: string;
  season_id: string | null;
  name: string;
  category: string;
  points: number;
  rule_type: "standard" | "special";
  priority: number;
  name_keywords: string[];
  allowed_weekdays: number[] | null;
  valid_from: string | null;
  valid_until: string | null;
  min_distance_m: number | null;
  allowed_sport_types: string[] | null;
  manual_entry_allowed: boolean;
  manual_entry_valid_from_rule: string | null;
  manual_entry_valid_until_rule: string | null;
  max_manual_entries_per_user: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  user_id: string;
  season_id: string;
  strava_activity_id: number | null;
  source: "strava" | "manual";
  activity_name: string;
  sport_type: string | null;
  distance_m: number | null;
  activity_started_at: string;
  activity_started_local_at: string | null;
  uploaded_or_created_at: string | null;
  category: string | null;
  points: number;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  matched_category: string | null;
  scoring_override_rule_id: string | null;
  awarded_points: number;
  scoring_reason: string | null;
  scored_at: string | null;
  status: "active" | "ignored" | "deleted";
  manually_entered: boolean;
  manual_comment: string | null;
  manual_entry_key: string | null;
  strava_url: string | null;
  created_at: string;
  updated_at: string;
};

type ManualEntryWindowRow = {
  id: string;
  category: string;
  weekday_start: number;
  time_start: string;
  weekday_end: number;
  time_end: string;
  points: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type AdminNotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  user_id: string | null;
  activity_id: string | null;
  read_at: string | null;
  created_at: string;
};

type WebhookEventRow = {
  id: string;
  object_type: string;
  object_id: number;
  aspect_type: string;
  owner_id: number;
  event_time: string;
  raw_payload: Json;
  processed_at: string | null;
  processing_status:
    | "pending"
    | "processing"
    | "processed"
    | "ignored"
    | "failed";
  processing_error: string | null;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      strava_connections: Table<StravaConnectionRow>;
      seasons: Table<SeasonRow>;
      scoring_rules: Table<ScoringRuleRow>;
      activities: Table<ActivityRow>;
      manual_entry_windows: Table<ManualEntryWindowRow>;
      admin_notifications: Table<AdminNotificationRow>;
      webhook_events: Table<WebhookEventRow>;
      audit_log: Table<AuditLogRow>;
    };
    Views: Record<string, never>;
    Functions: {
      get_leaderboard: {
        Args: {
          p_season_id?: string | null;
          p_category?: string | null;
          p_source?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_member_id?: string | null;
          p_sport_type?: string | null;
        };
        Returns: {
          place: number;
          user_id: string;
          display_name: string;
          season_id: string;
          season_name: string;
          total_points: number;
          total_rides: number;
          samstags_fahrten: number;
          mittwochs_fahrten: number;
          sonderevents: number;
          manual_points: number;
          last_activity_at: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

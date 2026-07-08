import type { Database } from "@/types/database";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id"
>;
type StravaConnectionRow = Pick<
  Database["public"]["Tables"]["strava_connections"]["Row"],
  "strava_athlete_id" | "user_id"
>;
type WebhookEventOwner = {
  owner_id: number;
};
type WebhookDisplayEvent = WebhookEventOwner & {
  aspect_type: string;
  created_at: string;
  object_id: number;
  object_type: string;
};

export function getWebhookOwnerLabel(
  ownerId: number,
  connections: StravaConnectionRow[],
  profiles: ProfileRow[],
) {
  const connection = connections.find(
    (entry) => entry.strava_athlete_id === ownerId,
  );
  const profile = connection
    ? profiles.find((entry) => entry.id === connection.user_id)
    : null;

  return profile?.display_name ?? formatAthleteFallback(ownerId);
}

export function addWebhookOwnerLabels<Event extends WebhookEventOwner>(
  events: Event[],
  connections: StravaConnectionRow[],
  profiles: ProfileRow[],
) {
  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile.display_name]),
  );
  const profileIdsByAthleteId = new Map(
    connections.map((connection) => [
      connection.strava_athlete_id,
      connection.user_id,
    ]),
  );

  return events.map((event) => {
    const profileId = profileIdsByAthleteId.get(event.owner_id);
    const displayName = profileId ? profilesById.get(profileId) : null;

    return {
      ...event,
      ownerLabel: displayName ?? formatAthleteFallback(event.owner_id),
    };
  });
}

export function dedupeWebhookEventsForDisplay<
  Event extends WebhookDisplayEvent,
>(events: Event[], limit: number) {
  const latestEventsByKey = new Map<string, Event>();

  for (const event of events) {
    const key = [
      event.object_type,
      event.object_id,
      event.aspect_type,
      event.owner_id,
    ].join(":");
    const existingEvent = latestEventsByKey.get(key);

    if (
      !existingEvent ||
      event.created_at.localeCompare(existingEvent.created_at) > 0
    ) {
      latestEventsByKey.set(key, event);
    }
  }

  return [...latestEventsByKey.values()]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}

function formatAthleteFallback(ownerId: number) {
  return `Athlete ID ${ownerId}`;
}

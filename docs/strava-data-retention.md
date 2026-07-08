# Strava-Datenbereinigung

## Disconnect

Beim Trennen der Strava-Verbindung wird die lokale Verbindung auf
`revoked = true` gesetzt. `access_token`, `refresh_token`, `expires_at` und
`scope` werden entfernt. Dadurch kann keine weitere serverseitige
Synchronisation stattfinden. Wenn noch ein Refresh Token vorhanden ist, versucht
die App vorher, den Token bei Strava zu widerrufen.

## Bereinigung auf Nutzer- oder Admin-Anforderung

Die zentrale Funktion `purgeStravaDataForUser` entfernt die lokale
Strava-Verbindung und anonymisiert vorhandene Strava-Aktivitaeten. Erhalten
bleiben nur Wertungsdaten, die fuer die vereinsinterne Rangliste benoetigt
werden.

Bereinigt werden insbesondere:

- `activity_name` wird auf `Gelöschte Aktivität` gesetzt.
- `strava_url`, `strava_activity_id`, `distance_m`, `sport_type`,
  `uploaded_or_created_at` und `activity_started_local_at` werden entfernt.
- `activity_started_at` wird auf 12:00 UTC des gespeicherten Datums reduziert.
- `strava_erased_at` dokumentiert den Zeitpunkt der Bereinigung.
- Webhook-Rohdaten des betroffenen Athleten bzw. der betroffenen Aktivitaeten
  werden geloescht.
- Audit-Snapshots zu betroffenen Aktivitaeten werden redigiert.

`season_id`, `status`, `points`, `category`, Regelreferenzen und
Scoring-Ergebnisse bleiben erhalten, damit aggregierte Vereinswertungen nicht
durch einen spaeteren Loeschwunsch veraendert werden.

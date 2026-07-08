# Anforderungen: ZGB-Maglia-Rosa

Stand: 2026-06-26

## Ziel

Eine kostenlose bzw. möglichst kostenfreie Web-Anwendung, die mobil gut abrufbar ist, Strava-Aktivitäten von Vereinsmitgliedern automatisch über Strava OAuth und Strava Webhooks erfasst, Punkte nach Vereinsregeln berechnet und eine filter- sowie sortierbare Auswertungstabelle bereitstellt. Zusätzlich muss es zeitlich begrenzte manuelle Eingaben als Backup geben.

## Technologie-Stack

- Frontend: Next.js mit App Router, TypeScript, React, Tailwind CSS
- Backend: Supabase
  - Supabase Auth
  - Supabase Postgres
  - Supabase Row Level Security
  - Supabase Edge Functions oder Next.js API Routes, je nachdem was sauberer ist
- Deployment: Vercel für Frontend, Supabase für Datenbank/Auth/Functions
- Strava-Integration:
  - OAuth 2.0
  - Refresh Tokens
  - Webhook Subscription
  - Activity Fetch nach Webhook-Event
- Kein natives iOS/Android. Die Anwendung soll als responsive Web-App/PWA funktionieren.

## 1. Mitgliederregistrierung und Strava-Autorisierung

- Nutzer sollen sich einmalig über Strava OAuth verbinden.
- Beim ersten erfolgreichen Strava-Login wird ein interner User/Mitglied-Datensatz angelegt.
- Speichere:
  - interne User-ID
  - Strava Athlete ID
  - Anzeigename
  - Strava Refresh Token verschlüsselt oder zumindest serverseitig geschützt
  - Token-Ablaufdaten
  - Status: aktiv/inaktiv
  - Erstellungsdatum
- Access Tokens dürfen nicht dauerhaft clientseitig gespeichert werden.
- Refresh Token Handling muss serverseitig erfolgen.
- Wenn ein Nutzer Strava-Zugriff widerruft, muss der Status entsprechend gesetzt werden.

## 2. Wertungszeitraum / Saison

- Es muss eine Saison mit Start- und Enddatum definierbar sein.
- Admins müssen Saisonstart und Saisonende manuell setzen können.
- Aktivitäten außerhalb der aktiven Saison dürfen nicht in die Wertung eingehen.
- Nach Saisonende dürfen keine neuen manuellen Einträge für diese Saison mehr angelegt werden.
- Die Auswertung muss nach Saison filterbar sein.
- Es soll perspektivisch mehrere Saisons geben können.
- Daten vergangener Saisons bleiben erhalten.

## 3. Automatischer Sync über Strava Webhooks

- Richte einen Webhook-Endpunkt ein:
  - GET-Verifikation für Strava Webhook Challenge
  - POST-Verarbeitung für Events
- Unterstützte Events:
  - activity created
  - activity updated
  - activity deleted
  - athlete authorization revoked
- Bei activity created/updated:
  - Ermittle den betroffenen Athlete/User.
  - Aktualisiere Access Token bei Bedarf über Refresh Token.
  - Lade die Aktivität von Strava nach.
  - Speichere nur die für die Wertung notwendigen Daten.
  - Berechne Punkte nach Regelwerk.
  - Aktualisiere die Auswertung.
- Bei activity deleted:
  - Markiere Aktivität als gelöscht oder entferne sie logisch aus der Wertung.
  - Keine harte Löschung, damit Audit möglich bleibt.
- Bei revoke:
  - Setze User auf `strava_revoked = true`.
  - Token nicht mehr verwenden.
- Webhook-Verarbeitung muss idempotent sein.
  - Doppelte Events dürfen keine doppelten Aktivitäten erzeugen.
  - Verwende `strava_activity_id` als eindeutigen Schlüssel.
- Ergänze einen manuellen Resync-Button für Admins:
  - Für einen einzelnen User
  - Für alle aktiven User
  - Nur für eine ausgewählte Saison
- Ergänze optional einen täglichen Fallback-Sync, falls Webhook-Events verpasst werden.

## 4. Gespeicherte Aktivitätsdaten

Es dürfen keine detaillierten Leistungs- oder GPS-Daten veröffentlicht werden. Speichere und zeige nur:

- Mitglied/User
- Strava Activity ID
- Datum/Zeit der Aktivität
- lokales Startdatum
- lokaler Startzeitpunkt
- Aktivitätsname
- Sporttyp / Aktivitätstyp
- Quelle: `strava` oder `manual`
- erkannte Kategorie
- Punkte
- Saison
- Status: active/deleted/ignored
- Zeitstempel der Erfassung/Aktualisierung
- optionaler Originalaktivitaetslink intern, aber nicht zwingend öffentlich

Nicht speichern oder anzeigen:

- GPS-Track
- Polyline
- Herzfrequenz
- Leistungsdaten/Watt
- Segmentdaten
- genaue Routen
- private Beschreibungen, sofern nicht notwendig

## 5. Punktelogik

Implementiere eine regelbasierte Scoring Engine.

### Standardregeln

#### A) Samstags-Fondo

- Punkte: 100
- Gültig, wenn:
  - Aktivität wurde am Samstag oder Sonntag hochgeladen bzw. gestartet.
  - Aktivitätsname enthält case-insensitive `fondo`.
  - Aktivität liegt innerhalb der aktiven Saison.
- Kategorie: `fondo`
- Zählt in Auswertungsspalte: `samstags_fahrten`

#### B) ZGB Zug / Scuderia / Scuola

- Punkte: 80
- Gültig, wenn:
  - Aktivität wurde am Mittwoch oder Donnerstag hochgeladen bzw. gestartet.
  - Aktivitätsname enthält case-insensitive eines der folgenden Schlüsselwörter:
    - `zgb`
    - `zug`
    - `scuola`
    - `scuderia`
  - Aktivität liegt innerhalb der aktiven Saison.
- Kategorie: je nach Match:
  - `zgb_zug`
  - `scuola`
  - `scuderia`
- Zählt in Auswertungsspalte: `mittwochs_fahrten`

#### C) Sonderevents

- Admins müssen Sonderregeln anlegen können.
- Eine Sonderregel besteht mindestens aus:
  - Name
  - Punkte
  - Saison
  - gültig von Datum/Uhrzeit
  - gültig bis Datum/Uhrzeit
  - Match-Kriterium Aktivitätsname enthält
  - optional erlaubte Wochentage
  - optional Mindestdistanz
  - optional Aktivitätstyp/Sporttyp
  - Priorität
  - aktiv/inaktiv
- Sonderevents zählen in Auswertungsspalte: `sonderevents`
- Sonderevents müssen über die Datenbank konfigurierbar sein, nicht hart im Code.

### Regelkonflikte

- Eine Aktivität darf nur einmal Punkte erhalten.
- Regeln haben Priorität.
- Wenn mehrere Regeln matchen, gewinnt die Regel mit höchster Priorität.
- Bei gleicher Priorität gewinnt die spezifischere Regel:
  1. Sonderevent
  2. Fondo
  3. ZGB/Zug/Scuola/Scuderia
- Speichere bei jeder Aktivität:
  - matched_rule_id
  - matched_rule_name
  - matched_category
  - awarded_points
  - scoring_reason als kurzer Text
  - scored_at

## 6. Manuelle Eingabe

Es muss eine manuelle Eingabe als Backup geben.

### Zeitfenster

#### A) Fondo

- Manuelle Eingabe erlaubt von Samstag 10:00 Uhr bis Sonntag 18:00 Uhr.
- Kategorie: Fondo
- Punkte: 100
- Saison muss aktiv sein.
- Nach Saisonende keine Eingabe mehr möglich.

#### B) ZGB/Zug/Scuola/Scuderia

- Manuelle Eingabe erlaubt von Mittwoch 18:00 Uhr bis Donnerstag 18:00 Uhr.
- Kategorie auswählbar:
  - ZGB Zug
  - Scuderia
  - Scuola
- Punkte: 80
- Saison muss aktiv sein.
- Nach Saisonende keine Eingabe mehr möglich.

#### C) Sonderevents

- Manuelle Eingabe für Sonderevents nur innerhalb des für das Sonderevent definierten Zeitfensters.
- Punkte gemäß Sonderregel.

### Freigabe

- Keine Admin-Freigabe erforderlich.
- Manuelle Einträge werden direkt gewertet.
- Es muss aber eine Benachrichtigung an Admins geben.
- Benachrichtigung kann im MVP als Eintrag in einer Admin-Notification-Tabelle erfolgen.
- Optional später E-Mail/Discord/Slack.
- Originalaktivitaetslink ist nicht erforderlich.
- Trotzdem sollen manuelle Eingaben auditierbar sein.

### Manuelle Eingabe speichern

- User ID
- Saison ID
- Kategorie
- Datum/Zeit
- Punkte
- Quelle `manual`
- Created At
- Begründung/Kommentar optional
- Status `active`
- Notification erstellt: ja/nein

### Missbrauchsschutz

- Ein User darf im gleichen Zeitfenster für dieselbe Kategorie nicht beliebig viele manuelle Einträge erzeugen.
- Baue eine sinnvolle Default-Regel:
  - Maximal ein manueller Fondo-Eintrag pro User pro Wochenende.
  - Maximal ein manueller Mittwochs-Eintrag pro User pro Mittwoch/Donnerstag-Zeitfenster und Kategorie.
  - Sonderevent gemäß Sonderregel, standardmäßig maximal einmal pro User pro Sonderevent.
- Diese Limits müssen datenbankseitig oder serverseitig zuverlässig geprüft werden.

## 7. Auswertung / Leaderboard

Die Auswertung muss übersichtlich und mobil abrufbar sein.

### Leaderboard-Spalten

- Platz
- Name
- Gesamtpunkte
- Anzahl Fahrten gesamt
- Anzahl Samstags-Fondo-Fahrten
- Anzahl Mittwochsfahrten, also ZGB/Zug/Scuola/Scuderia
- Anzahl Sonderevents
- optional letzte gewertete Aktivität
- optional Punkte aus manuellen Eingaben

### Sortierung

- Standard: Gesamtpunkte absteigend
- Bei Punktegleichstand:
  1. mehr Gesamtfahrten
  2. mehr Fondo-Fahrten
  3. alphabetisch nach Name
- Nutzer muss sortieren können nach:
  - Platz
  - Name
  - Punkte
  - Anzahl Fahrten
  - Fondo
  - Mittwoch
  - Sonderevents

### Filter

- Saison
- Kategorie
- Quelle: alle / Strava / manuell
- Zeitraum innerhalb Saison
- Mitglied
- Aktivitätstyp/Kategorie

### Mobile UI

- Auf Desktop als Tabelle.
- Auf Mobil als kompakte Tabelle oder Card-Liste.
- Platz, Name und Punkte müssen sofort sichtbar sein.
- Details aufklappbar.
- Keine überbreiten Tabellen ohne horizontales Scroll-Konzept.
- Ladezustände, Fehlermeldungen und leere Zustände sauber darstellen.

## 8. Adminbereich

### Admin-Funktionen

- Saison anlegen
- Saison bearbeiten
- aktive Saison setzen
- Sonderevent-Regel anlegen/bearbeiten/deaktivieren
- Mitglieder anzeigen
- Mitglied aktiv/inaktiv setzen
- Aktivitäten eines Mitglieds anzeigen
- Manuelle Einträge anzeigen
- Admin-Benachrichtigungen anzeigen
- Resync auslösen
- Aktivität manuell neu bewerten
- Aktivität aus Wertung ausschließen
- Export als CSV

### Rollen

- `admin`
- `member`

Nur Admins dürfen:

- Saisons verwalten
- Regeln verwalten
- Resync auslösen
- Aktivitäten korrigieren
- Exporte erstellen

Members dürfen:

- eigenes Profil sehen
- Strava verbinden/trennen
- eigene Aktivitäten sehen
- manuelle Einträge im erlaubten Zeitfenster erstellen
- Leaderboard sehen

## 9. Datenbankschema

Entwerfe und implementiere Supabase/Postgres-Migrationen für mindestens folgende Tabellen.

### `profiles`

- id uuid primary key references auth.users
- display_name text not null
- role text check in ('admin', 'member')
- created_at timestamptz
- updated_at timestamptz

### `strava_connections`

- id uuid primary key
- user_id uuid references profiles(id)
- strava_athlete_id bigint unique not null
- access_token text
- refresh_token text not null
- expires_at timestamptz
- scope text
- revoked boolean default false
- created_at timestamptz
- updated_at timestamptz

### `seasons`

- id uuid primary key
- name text not null
- starts_on date not null
- ends_on date not null
- is_active boolean default false
- created_at timestamptz
- updated_at timestamptz

### `scoring_rules`

- id uuid primary key
- season_id uuid references seasons(id), nullable für globale Regeln
- name text not null
- category text not null
- points integer not null
- rule_type text check in ('standard', 'special')
- priority integer not null
- name_keywords text[] not null
- allowed_weekdays integer[] nullable, ISO weekday 1-7
- valid_from timestamptz nullable
- valid_until timestamptz nullable
- min_distance_m numeric nullable
- allowed_sport_types text[] nullable
- manual_entry_allowed boolean default false
- manual_entry_valid_from_rule text nullable
- manual_entry_valid_until_rule text nullable
- max_manual_entries_per_user integer default 1
- is_active boolean default true
- created_at timestamptz
- updated_at timestamptz

### `activities`

- id uuid primary key
- user_id uuid references profiles(id)
- season_id uuid references seasons(id)
- strava_activity_id bigint nullable
- source text check in ('strava', 'manual')
- activity_name text not null
- sport_type text nullable
- activity_started_at timestamptz not null
- activity_started_local_at timestamptz nullable
- uploaded_or_created_at timestamptz nullable
- category text nullable
- points integer default 0
- matched_rule_id uuid references scoring_rules(id) nullable
- scoring_reason text nullable
- status text check in ('active', 'ignored', 'deleted')
- manually_entered boolean default false
- manual_comment text nullable
- created_at timestamptz
- updated_at timestamptz
- unique(strava_activity_id) where strava_activity_id is not null

### `manual_entry_windows`

Optional, falls sinnvoller als reine Funktion:

- id uuid primary key
- category text
- weekday_start integer
- time_start time
- weekday_end integer
- time_end time
- points integer
- active boolean

### `admin_notifications`

- id uuid primary key
- type text not null
- title text not null
- message text not null
- user_id uuid nullable
- activity_id uuid nullable
- read_at timestamptz nullable
- created_at timestamptz

### `webhook_events`

- id uuid primary key
- object_type text
- object_id bigint
- aspect_type text
- owner_id bigint
- event_time timestamptz
- raw_payload jsonb
- processed_at timestamptz nullable
- processing_status text
- processing_error text nullable
- created_at timestamptz
- unique(object_type, object_id, aspect_type, event_time)

### `audit_log`

- id uuid primary key
- actor_user_id uuid nullable
- action text not null
- entity_type text not null
- entity_id uuid nullable
- before jsonb nullable
- after jsonb nullable
- created_at timestamptz

## 10. Row Level Security

Implementiere RLS-Policies:

- Members dürfen eigene Profile lesen.
- Members dürfen Leaderboard-Daten lesen.
- Members dürfen eigene Aktivitäten lesen.
- Members dürfen eigene manuelle Aktivitäten erstellen, aber nur über serverseitige Funktion/API mit Zeitfensterprüfung.
- Members dürfen keine Punkte direkt manipulieren.
- Admins dürfen alle relevanten Tabellen lesen und verwalten.
- Strava Tokens dürfen niemals direkt an den Client ausgeliefert werden.
- Nutze Views oder RPCs für Leaderboard-Ausgabe.

## 11. Backend-Funktionen / API-Endpunkte

Implementiere folgende Endpunkte oder Server Actions.

### Auth/Strava

- GET /api/strava/connect
  - startet OAuth Flow
- GET /api/strava/callback
  - verarbeitet OAuth Callback
  - speichert Tokens
  - legt User/Connection an
- POST /api/strava/disconnect
  - markiert Verbindung als getrennt oder revoked

### Webhook

- GET /api/strava/webhook
  - Challenge Verification
- POST /api/strava/webhook
  - speichert Event
  - verarbeitet Event idempotent

### Sync

- POST /api/admin/sync/user/:userId
- POST /api/admin/sync/all
- POST /api/admin/rescore/activity/:activityId
- POST /api/admin/rescore/season/:seasonId

### Manual

- POST /api/manual-entry
  - prüft aktuelle Saison
  - prüft Zeitfenster
  - prüft Duplicate Limits
  - erstellt Aktivität
  - berechnet Punkte
  - erstellt Admin-Benachrichtigung

### Leaderboard

- GET /api/leaderboard?seasonId=...
  - gibt aggregierte Wertung zurück
- GET /api/activities?seasonId=...&userId=...
  - gibt Aktivitätsliste nach Rechten gefiltert zurück

### Admin

- CRUD für seasons
- CRUD für scoring_rules
- GET admin notifications
- POST mark notification read
- CSV export

## 12. Scoring Engine

Implementiere eine zentrale TypeScript-Funktion:

```ts
scoreActivity(activity, rules, season): ScoringResult
```

Input:

- Aktivitätsname
- Sporttyp
- Startdatum lokal
- Upload-/Created-Zeitpunkt falls verfügbar
- Quelle
- Saison
- Regelmenge

Output:

- matched: boolean
- points: number
- category: string | null
- matchedRuleId: string | null
- reason: string

Wichtig:

- Case-insensitive Keyword-Matching.
- Deutsche und einfache Schreibvarianten berücksichtigen.
- Für `ZGB Zug` sollen `zgb` oder `zug` matchen.
- Für Scuola und Scuderia exakte Teilstrings.
- `fondo` matcht Fondo.
- Wochentage nach lokaler Zeit bewerten.
- Alle Datum/Zeit-Operationen robust mit Zeitzone Europe/Berlin behandeln.
- Saisonprüfung immer serverseitig.
- Nach Saisonende keine neuen wertenden Einträge.
- Re-Scoring muss deterministisch sein.

## 13. Frontend-Seiten

### `/`

- Weiterleitung zu /leaderboard

### `/login`

- Login/Registrierung
- Button: Mit Strava verbinden

### `/profile`

- eigener Status
- Strava verbunden ja/nein
- Verbindung erneuern/trennen
- eigene letzte Aktivitäten

### `/leaderboard`

- Saison-Auswahl
- Leaderboard
- Sortierung
- Filter
- Mobile Card View
- Desktop Table View

### `/manual`

- zeigt, ob aktuell ein manuelles Eingabefenster offen ist
- wenn offen:
  - Kategorieauswahl
  - Datum/Zeit
  - Kommentar optional
  - Absenden
- wenn geschlossen:
  - klare Anzeige des nächsten Fensters
- nach Saisonende:
  - Hinweis, dass keine Eintragung mehr möglich ist

### `/admin`

- Admin Dashboard
- offene Benachrichtigungen
- Sync Status
- letzte Webhook Events

### `/admin/seasons`

- Saisonverwaltung

### `/admin/rules`

- Regelverwaltung inklusive Sonderevents

### `/admin/members`

- Mitgliederverwaltung

### `/admin/activities`

- Aktivitätsprüfung, Filter, Re-Scoring, Ausschluss aus Wertung

### `/admin/export`

- CSV Export

## 14. UI-Anforderungen

- Sachliches, sauberes Interface.
- Mobile-first.
- Tailwind CSS.
- Keine unnötigen Animationen.
- Barrierearme Kontraste.
- Tabellen mit Sticky Header auf Desktop.
- Auf Mobil kompakte Cards.
- Status-Badges für:
  - Strava
  - Manuell
  - Sonderevent
  - Ignoriert
  - Gelöscht
- Fehler klar ausgeben:
  - Strava nicht verbunden
  - Saison nicht aktiv
  - Zeitfenster geschlossen
  - Eintrag bereits vorhanden
  - API-Limit/Sync-Fehler

## 15. Tests

Erstelle Tests für:

- Scoring Engine
  - Fondo am Samstag mit Name enthält Fondo ergibt 100
  - Fondo am Sonntag mit Name enthält Fondo ergibt 100
  - Fondo am Montag ergibt 0
  - ZGB am Mittwoch ergibt 80
  - Zug am Donnerstag ergibt 80
  - Scuola am Mittwoch ergibt 80
  - Scuderia am Donnerstag ergibt 80
  - ZGB am Freitag ergibt 0
  - Sonderevent gewinnt gegenüber Standardregel bei höherer Priorität
  - Aktivität außerhalb Saison ergibt 0
- Manuelle Eingabe-Zeitfenster
  - Samstag 10:00 offen für Fondo
  - Sonntag 18:00 noch offen oder definierte Grenzlogik sauber testen
  - Sonntag 18:01 geschlossen
  - Mittwoch 18:00 offen für ZGB/Scuola/Scuderia
  - Donnerstag 18:00 noch offen oder definierte Grenzlogik sauber testen
  - Donnerstag 18:01 geschlossen
- Duplicate Protection
- Leaderboard-Aggregation
- Webhook-Idempotenz
- Token Refresh Handling als Mock

## 16. Entwicklungsphasen

Arbeite strikt in den folgenden Phasen. Nach jeder Phase:

- Code formatieren
- TypeScript-Fehler beheben
- Tests laufen lassen
- Kurze Zusammenfassung der Änderungen geben
- Nächste Phase erst beginnen, wenn die vorherige stabil ist

# Finalisierung Phase 9 und 10

Stand: 2026-06-30

## Strava App Setup

1. Strava API Application unter `https://www.strava.com/settings/api` anlegen.
2. Callback Domain auf die produktive Domain setzen, z. B. `zgb-rangliste.vercel.app`.
3. Authorization Callback URL:
   - lokal: `http://127.0.0.1:3000/api/strava/callback`
   - produktiv: `https://<vercel-domain>/api/strava/callback`
4. Client ID als `STRAVA_CLIENT_ID` setzen.
5. Client Secret nur serverseitig als `STRAVA_CLIENT_SECRET` setzen.
6. Angeforderte Scopes bleiben minimal: `read`, `activity:read`.

## Webhook Setup

Webhook Callback:

```text
https://<vercel-domain>/api/strava/webhook
```

Pflichtwerte:

| Variable                      | Zweck                                            |
| ----------------------------- | ------------------------------------------------ |
| `STRAVA_VERIFY_TOKEN`         | frei gewähltes Verify Token für Strava Challenge |
| `STRAVA_WEBHOOK_CALLBACK_URL` | öffentliche Callback-URL                         |
| `APP_BASE_URL`                | öffentliche App-Basis-URL                        |
| `CRON_SECRET`                 | Bearer Secret für Vercel Cron                    |

Prüfung:

1. Vercel Cron `/api/cron/strava` führt die Strava Webhook Subscription automatisch mit Callback URL und Verify Token.
2. Strava GET-Challenge muss `hub.challenge` zurückgeben.
3. Eine Testaktivität erstellen oder aktualisieren.
4. In `/admin` kontrollieren, ob ein Webhook Event gespeichert und verarbeitet wurde.

## Supabase Setup

1. Neues Supabase-Projekt anlegen.
2. SQL-Migrationen aus `supabase/migrations` in Reihenfolge ausführen.
3. Environment Variables setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_AUTH_SECRET`
4. RLS prüfen:
   - `strava_connections` darf für `authenticated` keine Token-Spalten selektieren.
   - `get_leaderboard(...)` ist für `anon`, `authenticated`, `service_role` freigegeben.
   - Schreibende Admin- und Sync-Prozesse laufen über serverseitige API-Routen.
5. Seed-Regeln und aktive Saison kontrollieren.

## Admin Workflow

1. `/login` aufrufen und mit einem aktiven Profil anmelden, dessen `profiles.role` auf `admin` steht.
2. Dashboard prüfen:
   - offene Admin Notifications
   - Webhook Status
   - aktive Mitglieder
   - aktive Aktivitäten
3. Saison verwalten:
   - Saison anlegen
   - aktive Saison setzen
   - Saisonwechsel siehe Abschnitt unten
4. Regeln pflegen:
   - Standardregeln nur kontrolliert ändern
   - Sonderevents mit Zeitraum, Keywords, Punkten und Priorität anlegen
5. Aktivitäten prüfen:
   - Filter nutzen
   - einzelne Aktivität neu bewerten
   - falsche Aktivität ausschließen oder reaktivieren
6. Sync:
   - User-Resync für Einzelfälle
   - Gesamt-Resync sparsam verwenden, wegen Strava Rate-Limits
7. Exporte:
   - Leaderboard CSV
   - Aktivitäten CSV
   - Exporte werden im Audit Log erfasst.

## Nutzer Workflow

1. `/login` öffnen.
2. Mit Strava verbinden.
3. Strava-Berechtigungen `read` und `activity:read` bestätigen.
4. Profil unter `/profile` prüfen.
5. Gewertete Aktivitäten erscheinen nach Webhook-Verarbeitung im Leaderboard.
6. Manuelle Eingabe:
   - `/manual` öffnen
   - Name, Kategorie, Zeitpunkt und optionale Distanz/Kommentar erfassen
   - Server prüft Saison, Zeitfenster, Duplicate-Limit und Regelmatch
7. Strava trennen:
   - `/profile`
   - `Strava trennen`
   - lokale Verbindung wird widerrufen markiert.

## Lokale Synchronisation

1. `.env.local` mit Supabase-Werten, `APP_AUTH_SECRET`, Strava-Credentials, `STRAVA_VERIFY_TOKEN`, `STRAVA_WEBHOOK_CALLBACK_URL`, `APP_BASE_URL=http://127.0.0.1:3000` und `CRON_SECRET` füllen.
2. Lokale App mit `npm run dev` starten und mit einem aktiven Adminprofil über `/login` anmelden.
3. Strava-Verbindung im Profil prüfen oder neu verbinden.
4. Für einzelne Mitglieder `/admin/members` öffnen und `User resync` mit der gewünschten Saison starten.
5. Für Nachverarbeitung von Webhook-Events oder Subscription-Wartung lokal `/api/cron/strava` mit Bearer `CRON_SECRET` aufrufen.
6. Ergebnis in `/admin`, `/admin/activities` und `/leaderboard` kontrollieren.

## Regelpflege

Regelpflege erfolgt in `/admin/rules`.

Pflichtangaben:

| Feld           | Hinweis                                                       |
| -------------- | ------------------------------------------------------------- |
| Name           | sprechender Regelname                                         |
| Kategorie      | z. B. `fondo`, `zgb_zug`, `scuola`, `scuderia`, `sonderevent` |
| Punkte         | positive Ganzzahl                                             |
| Keywords       | alle Keywords müssen im Aktivitätsnamen vorkommen             |
| Wochentage     | ISO 1-7, optional                                             |
| Zeitraum       | für Sonderevents empfohlen                                    |
| Mindestdistanz | optional, in km                                               |
| Sporttypen     | optional, z. B. `Ride`                                        |
| Priorität      | höhere Zahl gewinnt                                           |

Nach Regelanpassung:

1. Betroffene Saison in `/admin/activities` filtern.
2. `Saison neu bewerten` ausführen.
3. Stichprobe im Leaderboard und Aktivitätslog prüfen.

## Saisonwechsel

1. Neue Saison in `/admin/seasons` anlegen.
2. Start- und Enddatum prüfen.
3. Neue Saison aktiv setzen.
4. Standardregeln für neue Saison prüfen oder globale Regeln weiterverwenden.
5. Sonderevents der alten Saison deaktivieren oder auf neue Saison kopieren.
6. Manuelle Eingabefenster und Regelzeiträume prüfen.
7. Testeintrag oder Mock-E2E-Test ausführen.
8. Leaderboard mit aktiver Saison prüfen.

## Security Review

| Bereich                      | Status    | Bewertung                                                                                                                               |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Strava Tokens im Client      | umgesetzt | Client importiert nur Public Env; Token-Spalten werden nicht im Client selektiert.                                                      |
| Service Role Key             | umgesetzt | Nutzung nur in serverseitigen API-/Server-Modulen.                                                                                      |
| Leaderboard-Datensparsamkeit | umgesetzt | Public Response enthält aggregierte Rankingfelder, keine Aktivitätsnamen, URLs, Distanzen oder Kommentare.                              |
| RLS                          | umgesetzt | Anwendungstabellen haben RLS; Token-Spaltenrechte sind eingeschränkt.                                                                   |
| Adminschutz                  | umgesetzt | Adminbereich und Admin-API laufen über normales App-Session-Cookie plus aktive Rolle `admin`; POST-Routen prüfen zusätzlich den Origin. |
| Audit Log                    | erweitert | Schreibende Adminaktionen, Notifications und CSV-Exporte werden auditierbar.                                                            |
| Logging                      | erweitert | Strukturierte Logs mit Redaction für Tokens/Secrets.                                                                                    |
| Rate Limits                  | erweitert | Strava 429 wird als Rate-Limit-Fehler mit Retry-Hinweis behandelt.                                                                      |
| Error Boundaries             | umgesetzt | Globale und Admin-spezifische Error/Loading Boundaries vorhanden.                                                                       |

## Offene Punkte und technische Einschränkungen

| Punkt                     | Einschränkung                                                                                                                  | Empfehlung                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Token-Verschlüsselung     | Tokens liegen serverseitig in Postgres, aber nicht feldweise verschlüsselt.                                                    | Vor Produktivbetrieb Supabase Vault oder eigene Envelope Encryption prüfen.                                      |
| Admin-Rollenpflege        | Adminzugriff hängt an `profiles.role = 'admin'` und aktivem Profilstatus. Der letzte aktive Admin wird serverseitig geschützt. | Adminrollen nur bewusst in `/admin/members` vergeben und nach Rollenänderungen einmal mit normalem Login prüfen. |
| Webhook Subscription      | Wird über `/api/cron/strava` automatisch angelegt und bei falscher Callback-URL ersetzt.                                       | `CRON_SECRET` in Vercel setzen und Cron-Logs nach dem ersten Deployment prüfen.                                  |
| Fallback Sync             | Tritt maximal täglich als kleiner Backfill für aktive Mitglieder auf.                                                          | Bei höherer Last Job Queue oder dedizierte Scheduled Function mit Backoff nutzen.                                |
| Rate-Limit Backoff        | Fehler wird erkannt, aber kein Queue-/Retry-System.                                                                            | Bei höherer Last Job Queue mit Backoff einführen.                                                                |
| E-Mail/Push Notifications | Admin Notifications sind nur In-App.                                                                                           | Optional E-Mail, Discord oder Slack anbinden.                                                                    |
| Vollständiger Browser-E2E | Aktuell reproduzierbarer Mock-E2E in Vitest.                                                                                   | Für Release zusätzlich Playwright gegen Staging mit Test-Supabase nutzen.                                        |
| Testdaten                 | Seed-Saison ist als Test-Saison 2026 markiert.                                                                                 | Vor Produktivstart echte Saison anlegen und Test-Saison deaktivieren oder entfernen.                             |

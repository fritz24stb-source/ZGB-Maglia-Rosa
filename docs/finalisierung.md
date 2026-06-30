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

| Variable                      | Zweck                                              |
| ----------------------------- | -------------------------------------------------- |
| `STRAVA_VERIFY_TOKEN`         | frei gewaehltes Verify Token fuer Strava Challenge |
| `STRAVA_WEBHOOK_CALLBACK_URL` | oeffentliche Callback-URL                          |
| `APP_BASE_URL`                | oeffentliche App-Basis-URL                         |

Pruefung:

1. Strava Webhook Subscription mit Callback URL und Verify Token registrieren.
2. Strava GET-Challenge muss `hub.challenge` zurueckgeben.
3. Eine Testaktivitaet erstellen oder aktualisieren.
4. In `/admin` kontrollieren, ob ein Webhook Event gespeichert und verarbeitet wurde.

## Supabase Setup

1. Neues Supabase-Projekt anlegen.
2. SQL-Migrationen aus `supabase/migrations` in Reihenfolge ausfuehren.
3. Environment Variables setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. RLS pruefen:
   - `strava_connections` darf fuer `authenticated` keine Token-Spalten selektieren.
   - `get_leaderboard(...)` ist fuer `anon`, `authenticated`, `service_role` freigegeben.
   - Schreibende Admin- und Sync-Prozesse laufen ueber serverseitige API-Routen.
5. Seed-Regeln und aktive Saison kontrollieren.

## Admin Workflow

1. `/admin/login` mit `ADMIN_PASSWORD` aufrufen.
2. Dashboard pruefen:
   - offene Admin Notifications
   - Webhook Status
   - aktive Mitglieder
   - aktive Aktivitaeten
3. Saison verwalten:
   - Saison anlegen
   - aktive Saison setzen
   - Saisonwechsel siehe Abschnitt unten
4. Regeln pflegen:
   - Standardregeln nur kontrolliert aendern
   - Sonderevents mit Zeitraum, Keywords, Punkten und Prioritaet anlegen
5. Aktivitaeten pruefen:
   - Filter nutzen
   - einzelne Aktivitaet neu bewerten
   - falsche Aktivitaet ausschliessen oder reaktivieren
6. Sync:
   - User-Resync fuer Einzelfaelle
   - Gesamt-Resync sparsam verwenden, wegen Strava Rate-Limits
7. Exporte:
   - Leaderboard CSV
   - Aktivitaeten CSV
   - Exporte werden im Audit Log erfasst.

## Nutzer Workflow

1. `/login` oeffnen.
2. Mit Strava verbinden.
3. Strava-Berechtigungen `read` und `activity:read` bestaetigen.
4. Profil unter `/profile` pruefen.
5. Gewertete Aktivitaeten erscheinen nach Webhook-Verarbeitung im Leaderboard.
6. Manuelle Eingabe:
   - `/manual` oeffnen
   - Name, Kategorie, Zeitpunkt und optionale Distanz/Kommentar erfassen
   - Server prueft Saison, Zeitfenster, Duplicate-Limit und Regelmatch
7. Strava trennen:
   - `/profile`
   - `Strava trennen`
   - lokale Verbindung wird widerrufen markiert.

## Regelpflege

Regelpflege erfolgt in `/admin/rules`.

Pflichtangaben:

| Feld           | Hinweis                                                       |
| -------------- | ------------------------------------------------------------- |
| Name           | sprechender Regelname                                         |
| Kategorie      | z. B. `fondo`, `zgb_zug`, `scuola`, `scuderia`, `sonderevent` |
| Punkte         | positive Ganzzahl                                             |
| Keywords       | alle Keywords muessen im Aktivitaetsnamen vorkommen           |
| Wochentage     | ISO 1-7, optional                                             |
| Zeitraum       | fuer Sonderevents empfohlen                                   |
| Mindestdistanz | optional, in km                                               |
| Sporttypen     | optional, z. B. `Ride`                                        |
| Prioritaet     | hoehere Zahl gewinnt                                          |

Nach Regelanpassung:

1. Betroffene Saison in `/admin/activities` filtern.
2. `Saison neu bewerten` ausfuehren.
3. Stichprobe im Leaderboard und Aktivitaetslog pruefen.

## Saisonwechsel

1. Neue Saison in `/admin/seasons` anlegen.
2. Start- und Enddatum pruefen.
3. Neue Saison aktiv setzen.
4. Standardregeln fuer neue Saison pruefen oder globale Regeln weiterverwenden.
5. Sonderevents der alten Saison deaktivieren oder auf neue Saison kopieren.
6. Manuelle Eingabefenster und Regelzeitraeume pruefen.
7. Testeintrag oder Mock-E2E-Test ausfuehren.
8. Leaderboard mit aktiver Saison pruefen.

## Security Review

| Bereich                      | Status    | Bewertung                                                                                                    |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Strava Tokens im Client      | umgesetzt | Client importiert nur Public Env; Token-Spalten werden nicht im Client selektiert.                           |
| Service Role Key             | umgesetzt | Nutzung nur in serverseitigen API-/Server-Modulen.                                                           |
| Leaderboard-Datensparsamkeit | umgesetzt | Public Response enthaelt aggregierte Rankingfelder, keine Aktivitaetsnamen, URLs, Distanzen oder Kommentare. |
| RLS                          | umgesetzt | Anwendungstabellen haben RLS; Token-Spaltenrechte sind eingeschraenkt.                                       |
| Adminschutz                  | umgesetzt | Adminbereich ueber HTTP-only Cookie und Origin-Check fuer POST-Routen.                                       |
| Audit Log                    | erweitert | Schreibende Adminaktionen, Notifications und CSV-Exporte werden auditierbar.                                 |
| Logging                      | erweitert | Strukturierte Logs mit Redaction fuer Tokens/Secrets.                                                        |
| Rate Limits                  | erweitert | Strava 429 wird als Rate-Limit-Fehler mit Retry-Hinweis behandelt.                                           |
| Error Boundaries             | umgesetzt | Globale und Admin-spezifische Error/Loading Boundaries vorhanden.                                            |

## Offene Punkte und technische Einschraenkungen

| Punkt                      | Einschraenkung                                                                | Empfehlung                                                                           |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Token-Verschluesselung     | Tokens liegen serverseitig in Postgres, aber nicht feldweise verschluesselt.  | Vor Produktivbetrieb Supabase Vault oder eigene Envelope Encryption pruefen.         |
| Admin Auth                 | MVP nutzt einzelnes `ADMIN_PASSWORD`, keine personenbezogenen Admin-Accounts. | Fuer mehrere Admins Supabase Auth Rollen oder separate Admin-User einfuehren.        |
| Webhook Subscription       | Registrierung wird nicht automatisch vom Code erstellt.                       | Einrichtung dokumentiert ausfuehren und Subscription-ID betrieblich notieren.        |
| Fallback Sync              | Kein geplanter Cron im Free-MVP.                                              | Bei Bedarf Vercel Cron, GitHub Actions oder Supabase Scheduled Function ergaenzen.   |
| Rate-Limit Backoff         | Fehler wird erkannt, aber kein Queue-/Retry-System.                           | Bei hoeherer Last Job Queue mit Backoff einfuehren.                                  |
| E-Mail/Push Notifications  | Admin Notifications sind nur In-App.                                          | Optional E-Mail, Discord oder Slack anbinden.                                        |
| Vollstaendiger Browser-E2E | Aktuell reproduzierbarer Mock-E2E in Vitest.                                  | Fuer Release zusaetzlich Playwright gegen Staging mit Test-Supabase nutzen.          |
| Testdaten                  | Seed-Saison ist als Test-Saison 2026 markiert.                                | Vor Produktivstart echte Saison anlegen und Test-Saison deaktivieren oder entfernen. |

# ZGB-Maglia-Rosa

Mobile-first PWA für die vereinsinterne Rennrad-Wertung von ZGB Cycling.

## Phase 1 Umfang

- Next.js App Router mit TypeScript
- Tailwind CSS Grunddesign
- PWA Manifest
- Supabase Browser-, Server- und Service-Role-Client vorbereitet
- Environment-Variablen dokumentiert
- Rollen- und Navigationsstruktur vorbereitet
- Routen-Skelett für Leaderboard, Profil, manuelle Eingabe und Adminbereiche

## Phase 2 Umfang

- Supabase SQL-Migrationen für Tabellen, Constraints und Indizes
- RLS-Policies für Admin- und Member-Zugriffe
- Token-Spaltenrechte für Strava-Verbindungen
- Leaderboard-RPC `public.get_leaderboard(...)`
- Seed-Daten für Test-Saison 2026, Standardregeln und manuelle Eingabefenster
- Betriebsannahmen in `docs/operations.md`

## Phase 3 Umfang

- Strava Connect Flow über `/api/strava/connect`
- OAuth Callback über `/api/strava/callback`
- serverseitige Profilanlage und Token-Speicherung
- Refresh-Token-Utility für serverseitige Sync-Prozesse
- Disconnect-Endpunkt mit Strava Revoke und lokaler Revoked-Markierung
- Profilseite mit Strava-Verbindungsstatus

## Phase 4 Umfang

- zentrale Scoring Engine in `lib/scoring`
- Standard- und Sonderevent-Regeln aus `scoring_rules`
- Regelmatching nach Saison, Keywords, Wochentag, Zeitraum, Sportart, Distanz und manueller Quelle
- Re-Scoring-Funktion für saisonweite oder aktivitätsbezogene Neubewertung
- Unit Tests für Scoring und Re-Scoring

## Phase 5 Umfang

- Strava Webhook GET-Verifikation über `/api/strava/webhook`
- Webhook POST mit schneller Event-Queue in `webhook_events` und nachgelagerter Verarbeitung
- idempotente Verarbeitung über Event-Claiming und bestehende Unique-Constraints
- Activity Fetch nach Create-/Update-Events
- idempotenter Activity-Upsert inklusive Scoring
- logische Behandlung von Delete-Events über `activities.status = 'deleted'`
- Revoke-/Deauthorization-Events mit lokaler Revoked-Markierung
- Fehler- und Ignore-Gruende in `webhook_events.processing_error`
- Automatische Subscription-Wartung und täglicher Fallback-Sync über `/api/cron/strava`

## Phase 6 Umfang

- Leaderboard API über `/api/leaderboard`
- Aggregation über `public.get_leaderboard(...)` mit Gesamtpunkten, Gesamtfahrten, Samstags-Fondo-Fahrten, Mittwochsfahrten, Sonderevents und Platzierung
- API-seitige Filter für Saison, Kategorie, Quelle, Zeitraum und Sportart
- API-seitige Sortierung nach Platz, Name, Punkten, Fahrten, Fondo, Mittwoch, Sonderevents, manuellen Punkten und letzter Aktivität
- Mobile- und Desktop-UI für Filter, Sortierung, Summary-Kennzahlen, Fehler-, Leer- und Tabellen-/Kartenansichten
- Tests für Query-Normalisierung, aktive Saison als Default und stabile Sortierung

## Phase 7 Umfang

- Manuelle Eingabefenster für Fondo, Mittwochskategorien und Sonderevents
- Servervalidierung für Auth, aktive Saison, Mitgliederstatus, Zeitfenster, Eingabedaten und Scoring-Regel
- Duplicate Protection über deterministische `manual_entry_key`-Fenster und bestehenden Unique-Index
- Manuelle Aktivität mit direkter Punktezuweisung und Scoring-Metadaten
- Admin-Benachrichtigung pro manueller Aktivität
- Mobile Formular-UI für offene, geschlossene und bereits genutzte Zeitfenster
- Anzeige des nächsten ermittelten Zeitfensters
- Tests für Zeitfenstergrenzen, lokale Berlin-Zeit, Duplicate-Status und Sonderevent-Fenster

## Phase 8 Umfang

- Admin-Dashboard mit Kennzahlen, offenen Benachrichtigungen, Webhook-Status und Gesamt-Resync
- Saisonverwaltung mit Anlegen, Bearbeiten und aktiver Saison
- Regelverwaltung für Standardregeln und Sonderevents inklusive manueller Eingaberegeln
- Mitgliederverwaltung mit Rolle, Aktivstatus, Strava-Status, Aktivitätslink und User-Resync
- Aktivitätsübersicht mit Filtern, manuellen Einträgen, Re-Scoring und Ausschluss/Reaktivierung
- Admin-API-Routen für Sync, Re-Scoring, Statuskorrekturen, Benachrichtigungen und CSV-Export
- CSV-Export für Leaderboard und Aktivitäten
- Audit-Log für schreibende Admin-Aktionen
- Tests für Admin-Formularnormalisierung und CSV-Escaping

## Phase 9/10 Abschluss

- Server-/Client-Environment getrennt, damit Secrets nicht in Client-Bundles gelangen.
- Redaction für Logging und Audit-Log ergänzt.
- Strava Rate-Limit-Fehler werden mit nutzbarer Meldung behandelt.
- Error Boundaries und Loading States für App und Adminbereich ergänzt.
- Audit Log auf Benachrichtigungen und CSV-Exporte erweitert.
- Mock-End-to-End-Test für Scoring bis Leaderboard ergänzt.
- Alte ungenutzte Produktiv-Mockdaten entfernt.
- Abschlussdokumentation: `docs/finalisierung.md`

## Login- und Zugriffsmodell

- Strava Login ist nur für das Verknüpfen eines Athleten und für späteres Trennen der Strava-Verbindung notwendig.
- Aktivitäten werden nach der Verknüpfung über Strava Webhooks und serverseitige Tokens verarbeitet; dafür ist keine aktive Benutzersession erforderlich.
- Das Leaderboard ist ohne Benutzerlogin sichtbar und wird serverseitig über `/api/leaderboard` geladen.
- Der Adminbereich unter `/admin` wird über den normalen Login geschützt. Zugriff erhalten nur aktive Profile mit `profiles.role = 'admin'`.

## Lokale Entwicklung

1. `.env.example` nach `.env.local` kopieren und Werte setzen.
2. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

3. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

Ohne Supabase-Werte können Leaderboard, Profilseite, Profile oder Strava-Verbindung nicht geladen werden. Für lokale Profil-, Leaderboard- und OAuth-Tests müssen mindestens diese Werte in `.env.local` gesetzt sein:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
APP_BASE_URL=http://127.0.0.1:3000
```

Für den Strava-Connect-Flow kommen zusätzlich hinzu:

```bash
STRAVA_CLIENT_ID=<strava-client-id>
STRAVA_CLIENT_SECRET=<strava-client-secret>
STRAVA_VERIFY_TOKEN=<eigener-webhook-verify-token>
STRAVA_WEBHOOK_CALLBACK_URL=http://127.0.0.1:3000/api/strava/webhook
```

Für App-Sitzungen und Cron:

```bash
APP_AUTH_SECRET=<langer-zufälliger-session-secret>
CRON_SECRET=<zufälliger-cron-secret>
```

## Setup Kurzcheck

| Schritt    | Prüfung                                                                             |
| ---------- | ----------------------------------------------------------------------------------- |
| Supabase   | Migrationen aus `supabase/migrations` in Reihenfolge ausführen                      |
| Strava App | Callback `/api/strava/callback`, Scopes `read,activity:read_all`                    |
| Webhook    | `STRAVA_WEBHOOK_CALLBACK_URL` zeigt auf `/api/strava/webhook`                       |
| Cron       | `CRON_SECRET` setzen; `/api/cron/strava` wird über `vercel.json` täglich ausgeführt |
| Admin      | Mit normalem Login anmelden; `profiles.role = 'admin'` für Adminprofile prüfen      |
| Regeln     | aktive Saison und Standardregeln in `/admin/seasons` und `/admin/rules` prüfen      |

## Deployment Vercel/Supabase

1. Supabase-Projekt anlegen und Migrationen ausführen.
2. Vercel-Projekt mit diesem Repository verbinden.
3. In Vercel Environment Variables setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `STRAVA_VERIFY_TOKEN`
   - `STRAVA_WEBHOOK_CALLBACK_URL`
   - `APP_BASE_URL`
   - `APP_AUTH_SECRET`
   - `CRON_SECRET`
4. `APP_BASE_URL` auf die Vercel-Produktionsdomain setzen.
5. `STRAVA_WEBHOOK_CALLBACK_URL` auf `https://<domain>/api/strava/webhook` setzen.
6. Strava App Callback Domain für OAuth auf die Vercel-Domain setzen.
7. Deployment bauen und `/leaderboard`, `/login`, `/manual`, `/admin` mit Adminprofil prüfen.
8. Nach dem ersten Cron-Lauf prüfen, ob `/api/cron/strava` die Strava Push Subscription angelegt hat.

Details zu Strava App, Webhook, Supabase, Admin Workflow, Nutzer Workflow, Regelpflege, Saisonwechsel, Security Review und offenen Punkten stehen in `docs/finalisierung.md`.

## Environment Variables

| Variable                        | Zweck                                      |
| ------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Projekt-URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key für Client/Auth          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only Key für privilegierte Aktionen |
| `STRAVA_CLIENT_ID`              | Strava OAuth Client ID                     |
| `STRAVA_CLIENT_SECRET`          | Strava OAuth Secret, nur serverseitig      |
| `STRAVA_VERIFY_TOKEN`           | Verify Token für Strava Webhook Challenge  |
| `STRAVA_WEBHOOK_CALLBACK_URL`   | Öffentliche Webhook-Callback-URL           |
| `APP_BASE_URL`                  | Basis-URL der App                          |
| `APP_AUTH_SECRET`               | Signatur-Secret für App-Session-Cookies    |
| `CRON_SECRET`                   | Bearer Secret für Vercel Cron              |

## Qualitätsbefehle

```bash
npm run format
npm run typecheck
npm test
npm run build
```

## Phasenabschluss

Nach jeder Entwicklungsphase ist verbindlich:

1. Code formatieren: `npm run format`
2. TypeScript, Lint, Tests und Build prüfen:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

3. Änderungen versionieren und pushen:

   ```bash
   git status
   git add .
   git commit -m "Phase X: <kurze Beschreibung>"
   git push
   ```

4. App erreichbar schalten und URL prüfen:
   - lokal: `npm run dev` oder `npm run build` + `npm run start`
   - deployed: Vercel Deployment prüfen
   - mindestens `/leaderboard` muss erreichbar sein
   - die erreichbare URL im Phasenabschluss notieren

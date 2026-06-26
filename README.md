# ZGB Strava Rangliste

Mobile-first PWA fuer eine vereinsinterne Rennrad-Wertung auf Basis von Strava-Aktivitaeten.

## Phase 1 Umfang

- Next.js App Router mit TypeScript
- Tailwind CSS Grunddesign
- PWA Manifest
- Supabase Browser-, Server- und Service-Role-Client vorbereitet
- Environment-Variablen dokumentiert
- Rollen- und Navigationsstruktur vorbereitet
- Routen-Skelett fuer Leaderboard, Profil, manuelle Eingabe und Adminbereiche

## Phase 2 Umfang

- Supabase SQL-Migrationen fuer Tabellen, Constraints und Indizes
- RLS-Policies fuer Admin- und Member-Zugriffe
- Token-Spaltenrechte fuer Strava-Verbindungen
- Leaderboard-RPC `public.get_leaderboard(...)`
- Seed-Daten fuer Test-Saison 2026, Standardregeln und manuelle Eingabefenster
- Betriebsannahmen in `docs/operations.md`

## Phase 3 Umfang

- Strava Connect Flow ueber `/api/strava/connect`
- OAuth Callback ueber `/api/strava/callback`
- serverseitige Profilanlage und Token-Speicherung
- Refresh-Token-Utility fuer serverseitige Sync-Prozesse
- Disconnect-Endpunkt mit Strava Revoke und lokaler Revoked-Markierung
- Profilseite mit Strava-Verbindungsstatus

## Phase 4 Umfang

- zentrale Scoring Engine in `lib/scoring`
- Standard- und Sonderevent-Regeln aus `scoring_rules`
- Regelmatching nach Saison, Keywords, Wochentag, Zeitraum, Sportart, Distanz und manueller Quelle
- Re-Scoring-Funktion fuer saisonweite oder aktivitaetsbezogene Neubewertung
- Unit Tests fuer Scoring und Re-Scoring

## Lokale Entwicklung

1. `.env.example` nach `.env.local` kopieren und Werte setzen.
2. Abhaengigkeiten installieren:

   ```bash
   npm install
   ```

3. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

Ohne Supabase-Werte kann die Profilseite keine Session, Profile oder Strava-Verbindung laden. Fuer lokale Profil- und OAuth-Tests muessen mindestens diese Werte in `.env.local` gesetzt sein:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
APP_BASE_URL=http://127.0.0.1:3000
```

Fuer den Strava-Connect-Flow kommen zusaetzlich hinzu:

```bash
STRAVA_CLIENT_ID=<strava-client-id>
STRAVA_CLIENT_SECRET=<strava-client-secret>
STRAVA_VERIFY_TOKEN=<eigener-webhook-verify-token>
STRAVA_WEBHOOK_CALLBACK_URL=http://127.0.0.1:3000/api/strava/webhook
```

## Environment Variables

| Variable                        | Zweck                                       |
| ------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Projekt-URL                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key fuer Client/Auth          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only Key fuer privilegierte Aktionen |
| `STRAVA_CLIENT_ID`              | Strava OAuth Client ID                      |
| `STRAVA_CLIENT_SECRET`          | Strava OAuth Secret, nur serverseitig       |
| `STRAVA_VERIFY_TOKEN`           | Verify Token fuer Strava Webhook Challenge  |
| `STRAVA_WEBHOOK_CALLBACK_URL`   | Oeffentliche Webhook-Callback-URL           |
| `APP_BASE_URL`                  | Basis-URL der App                           |

## Qualitaetsbefehle

```bash
npm run format
npm run typecheck
npm test
npm run build
```

## Phasenabschluss

Nach jeder Entwicklungsphase ist verbindlich:

1. Code formatieren: `npm run format`
2. TypeScript, Lint, Tests und Build pruefen:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

3. Aenderungen versionieren und pushen:

   ```bash
   git status
   git add .
   git commit -m "Phase X: <kurze Beschreibung>"
   git push
   ```

4. App erreichbar schalten und URL pruefen:
   - lokal: `npm run dev` oder `npm run build` + `npm run start`
   - deployed: Vercel Deployment pruefen
   - mindestens `/leaderboard` muss erreichbar sein
   - die erreichbare URL im Phasenabschluss notieren

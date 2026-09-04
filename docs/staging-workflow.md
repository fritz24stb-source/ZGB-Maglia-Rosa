# Staging, Hotfixes und Produktionsrelease

## Dauerhafte Umgebungen

- `main` ist der Vercel-Produktionsbranch und verwendet nur die echte Supabase-Datenbank.
- `staging/maglia-wertungen` ist der langlebige Entwicklungsbranch und verwendet die bereinigte Supabase-Kopie.
- Vercel Preview-Variablen für den Staging-Branch müssen auf die Test-Project-Ref zeigen.
- Deployment Protection für Preview aktivieren, da kopierte Mitgliedsdaten enthalten sind.

## Supabase-Kopie einrichten

1. Produktionsbackup prüfen.
2. In Supabase ein neues Projekt aus einem Backup wiederherstellen oder den offiziellen CLI-Restore verwenden.
3. Test-URL, Anon Key, Service Role Key und Connection String in `.env.local` setzen.
4. `APP_ENV=local` und `EXPECTED_SUPABASE_PROJECT_REF=<test-ref>` setzen.
5. `npm run staging:sanitize` ausführen.
6. `LOCAL_ADMIN_PASSWORD` mit mindestens 14 Zeichen setzen und `npm run staging:admin` ausführen.
7. Migrationen erst prüfen und dann anwenden:
   - `npm run db:staging:status`
   - `npm run db:staging:dry-run`
   - `npm run db:staging:push`

Die vollständigen Postgres-URLs gehören nur in die lokale `.env.local` bzw. in den jeweiligen Terminalprozess. Sie werden nicht als Vercel-Variablen benötigt. Die vorhandenen Dump-Dateien `data.sql`, `roles.sql` und `schema.sql` sind lokal ignoriert und dürfen nicht committed werden.

## Lokaler Testzugang

- `npm run staging:admin` legt `local-admin@zgb.test` in der kopierten Supabase-Instanz an oder aktualisiert ihn.
- Das Kennwort kommt ausschließlich aus `LOCAL_ADMIN_PASSWORD` und muss mindestens 14 Zeichen lang sein.
- Der Zugang erhält die Rolle `admin` und kann damit alle lokalen Bereiche einschließlich Sprintwertung öffnen.
- Das Bereinigungsskript ersetzt zuvor die Kennwörter aller kopierten Auth-Benutzer durch Zufallswerte und entfernt Strava-Tokens, Passkeys, Einladungen und Webhook-Ereignisse.

## Strava im Test

Für normale Entwicklung mit kopierten Aktivitäten `STRAVA_RUNTIME_MODE=simulated` verwenden. Dann sind OAuth, Token-Aktualisierung, Abo-Pflege und das Widerrufen realer Strava-Verbindungen gesperrt.

Für einen echten Integrationstest eine separate Strava-Test-App und einen eigenen Test-Athleten verwenden:

1. Callback-Domain der Test-App auf `localhost` setzen und lokal `STRAVA_RUNTIME_MODE=local-readonly` verwenden.
2. Test-Client-ID, Test-Secret und einen eigenen Verify-Token in `.env.local` setzen.
3. Für einen Vercel-Test eine stabile Preview-/Staging-Domain verwenden und diese als Callback-Domain der Strava-Test-App eintragen. Zufällige Preview-URLs sind dafür ungeeignet.
4. Erst für diesen isolierten Test `STRAVA_TOKEN_REFRESH_ENABLED=true` setzen. `STRAVA_SUBSCRIPTION_MAINTENANCE_ENABLED` und `STRAVA_REVOKE_ENABLED` bleiben standardmäßig `false`.
5. Niemals Production-Strava-Credentials zusammen mit der Staging-Datenbank verwenden.

## Vercel

- Production-Variablen: echte Supabase-Werte, `STRAVA_RUNTIME_MODE=production`.
- Branch-spezifische Preview-Variablen: Test-Supabase, `STRAVA_RUNTIME_MODE=simulated`.
- Für `staging/maglia-wertungen` in Vercel eine feste Branch-Domain bzw. ein eigenes Staging-Projekt nutzen; so bleiben Preview-Variablen und Strava-Callback stabil.
- `CICLAMINO_ENABLED` und `AZZURRA_ENABLED` steuern die Zielgruppe getrennt: `false` sperrt die Wertung, `staff` erlaubt nur Admin und Scorekeeper, `true` erlaubt alle aktiven Mitglieder. `CLASSIFICATIONS_ENABLED` bleibt nur als Fallback für Ciclamino bestehen; Azzurra muss immer explizit freigegeben werden.
- Kein Vercel-Build darf `supabase db push` ausführen.

## Hotfix parallel zur Feature-Entwicklung

1. Ein separates Git-Worktree von `origin/main` anlegen.
2. Dort `hotfix/<name>` erstellen und ausschließlich den Produktionsfehler beheben.
3. Preview niemals auf die Produktionsdatenbank zeigen lassen.
4. Hotfix nach Prüfung nach `main` übernehmen.
5. `main` sofort in `staging/maglia-wertungen` übernehmen.
6. Enthält der Hotfix eine Migration, diese zuerst gegen ein produktionsgleiches Testschema und danach bewusst gegen Produktion ausführen; anschließend auch auf Staging anwenden.

## Produktionsmigration

Die Produktions-URL wird nur für den jeweiligen Terminalprozess gesetzt. Zusätzlich sind `EXPECTED_PRODUCTION_PROJECT_REF` und für den tatsächlichen Push `CONFIRM_PRODUCTION_REF` erforderlich.

1. `npm run db:production:status`
2. `npm run db:production:dry-run`
3. Produktionsbackup kontrollieren.
4. `npm run db:production:push`
5. Erst danach den kompatiblen Code nach `main` übernehmen.
6. Höhenmeter-Backfill durchführen und Vollständigkeit prüfen.
7. Für die gestaffelte Freigabe `CICLAMINO_ENABLED=true` und `AZZURRA_ENABLED=staff` setzen und neu deployen. Azzurra wird später mit `AZZURRA_ENABLED=true` allgemein freigegeben.

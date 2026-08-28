# Supabase-, GitHub- und Migrationsablauf

Diese Anleitung beschreibt den verbindlichen Ablauf fuer Datenbankmigrationen mit einer **Testdatenbank**, einer **Produktionsdatenbank** und mehreren Git-Branches.

Ziel ist, dass keine Migration und keine Testdaten versehentlich in der Produktionsdatenbank landen.

```powershell
Set-Location "C:\Users\Fri\Documents\ZGB Strava Rangliste"
```

## 1. Umgebungen und Branches

Die Datenbanken und Branches haben unterschiedliche Aufgaben. Die konkreten Projekt-Referenzen sind nicht im Repository zu hinterlegen.

| Umgebung | Git-Branch | Supabase-Projekt | Zweck | Daten |
| --- | --- | --- | --- | --- |
| Lokal | beliebig | lokaler Supabase-Stack (optional) | SQL- und automatisierte Tests | neu aus Migrationen erzeugt |
| Test | `staging/maglia-wertungen` und Feature-Branches | **Testdatenbank** | Integrationstest, manuelle Fachpruefung | ausschliesslich Testdaten |
| Produktion | `main` | **Produktionsdatenbank** | produktiver Betrieb | reale Daten |

Falls weitere Staging-Branches verwendet werden, gelten sie ebenfalls als Testumgebung. Ein Feature-Branch darf niemals gegen die Produktionsdatenbank gepusht werden.

Wichtige Begriffe:

| Begriff | Bedeutung |
| --- | --- |
| Migration | SQL-Datei in `supabase/migrations`. Sie beschreibt eine dauerhaft versionierte Schema- oder Datenänderung. |
| Testdaten | künstliche, anonymisierte oder ausdrücklich freigegebene Daten. Keine produktiven Nutzer-, Strava- oder Token-Daten. |
| Projekt-Ref | Kennung eines Supabase-Projekts, z. B. aus `https://<project-ref>.supabase.co`. |
| Linked Project | Das Supabase-Projekt, gegen das die CLI-Befehle ohne zusätzliche Zielangabe arbeiten. |

## 2. Sicherheitsregeln

| Regel | Bedeutung |
| --- | --- |
| Neue fachliche Änderung = neue Migration | Bereits in einer Remote-Datenbank ausgeführte Migrationen nie nachträglich ändern. |
| Reihenfolge: lokal → Test → Produktion | Jede Migration wird zuerst lokal und in der Testdatenbank geprüft. |
| Produktion nur von `main` | Ein Produktiv-Push ist erst nach Merge nach `main` zulässig. |
| Ziel vor jedem `db push` prüfen | Branch und verknüpftes Supabase-Projekt müssen zur Tabelle oben passen. |
| Keine Secrets oder Dumps committen | `.env.local`, Tokens, Passwörter und Datenbank-Dumps bleiben lokal bzw. im Secret-Store. |
| Korrekturen durch neue Migration | Rückrollen und Fixes erfolgen als neue, nachvollziehbare Migration. |
| Kein Remote-Reset | `supabase db reset --local` ist erlaubt; niemals `db reset` gegen Test oder Produktion verwenden. |

`supabase db push` ändert eine Datenbank. `git push` versioniert lediglich Dateien in GitHub. Beide Schritte sind getrennt zu prüfen.

## 3. `.env.local`: lokale App immer gegen die Testdatenbank

`.env.local` wird von Next.js beim lokalen Start geladen und ist nicht zu committen. Sie enthält die Zugangsdaten, die die lokal gestartete App verwendet. Für die normale lokale Entwicklung müssen dort **die Werte der Testdatenbank** stehen, nicht die der Produktion.

```dotenv
# Test-Supabase-Projekt: Werte aus Settings > API der TESTdatenbank
NEXT_PUBLIC_SUPABASE_URL=https://<test-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<test-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<test-service-role-key>

# Lokale Anwendung
APP_BASE_URL=http://localhost:3000
APP_AUTH_SECRET=<eigener-lokaler-zufaelliger-wert>
CRON_SECRET=<eigener-lokaler-zufaelliger-wert>

# Strava: nur Test-App bzw. Test-Credentials verwenden
STRAVA_CLIENT_ID=<test-client-id>
STRAVA_CLIENT_SECRET=<test-client-secret>
STRAVA_VERIFY_TOKEN=<test-webhook-verify-token>
STRAVA_WEBHOOK_CALLBACK_URL=http://localhost:3000/api/strava/webhook

# Optional, wenn E-Mail-Einladungen lokal getestet werden
INVITE_EMAIL_WEBHOOK_URL=
INVITE_EMAIL_WEBHOOK_SECRET=
```

| Variable | Erforderlich | Verwendung / Regel |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ja fuer DB/Auth im Browser | URL der **Testdatenbank**. Darf im Browser sichtbar sein. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja fuer DB/Auth im Browser | Anon-/Publishable-Key der **Testdatenbank**. |
| `SUPABASE_SERVICE_ROLE_KEY` | ja fuer privilegierte Serverrouten | Ausschliesslich serverseitig; niemals mit `NEXT_PUBLIC_` benennen oder committen. |
| `APP_BASE_URL` | ja | lokal `http://localhost:3000`; fuer Vercel jeweils die passende Deployment-URL. |
| `APP_AUTH_SECRET` | ja | pro Umgebung eigener zufälliger Wert. |
| `CRON_SECRET` | ja, wenn Cron aktiv | pro Umgebung eigener zufälliger Wert. |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | nur fuer Strava-Abläufe | Test- und Produktions-Credentials strikt trennen. |
| `STRAVA_VERIFY_TOKEN` | bei Webhook | pro Umgebung eigener Wert. |
| `STRAVA_WEBHOOK_CALLBACK_URL` | bei Webhook | muss zur jeweiligen lokalen/Test-/Produktions-URL passen. |
| `INVITE_EMAIL_WEBHOOK_URL`, `INVITE_EMAIL_WEBHOOK_SECRET` | optional | nur setzen, wenn die Einladungsintegration genutzt wird. |

Die Supabase-CLI liest diese App-Variablen nicht als Auswahl des Zielprojekts. Das CLI-Ziel wird separat per `supabase link --project-ref ...` gesetzt. Deshalb ist ein korrekter Inhalt von `.env.local` kein Ersatz für die Zielprüfung vor `supabase db push`.

Für Vercel werden dieselben Variablennamen als Environment Variables gepflegt, jedoch mit den Werten der jeweiligen Umgebung:

| Vercel-Umgebung | Datenbankwerte |
| --- | --- |
| Preview / Staging | Testdatenbank und Test-Secrets |
| Production | Produktionsdatenbank und Produktions-Secrets |

Produktionswerte gehören nicht in `.env.local`, `.env.example`, GitHub oder Markdown-Dateien.

## 4. Vorbereitung: Branch und Zielprojekt prüfen

Vor jeder Migration:

```powershell
git status --short --branch
git branch --show-current
supabase migration list --linked
```

Vor einem Remote-Push zusätzlich das erwartete Ziel explizit verknüpfen. So wird nicht auf einen alten CLI-Link vertraut.

### Testdatenbank

```powershell
# Nur auf Feature- oder Staging-Branch
git branch --show-current

# Testprojekt verknüpfen (Ref aus dem Supabase-Testprojekt)
supabase link --project-ref tyoffdgeercbkpbdswxh

# Migrationstand des Testprojekts prüfen
supabase migration list --linked
```

### Produktionsdatenbank

```powershell
# Muss exakt main ausgeben
git branch --show-current

# Erst dann Produktionsprojekt verknüpfen
supabase link --project-ref jegycrwzvorckdbawqya

# Migrationstand der Produktionsdatenbank prüfen
supabase migration list --linked
```

Wenn der Branch nicht passt, wird nicht gepusht. Auf `main` wechseln oder den Branch zunächst per Pull Request mergen. Nach einem Produktiv-Push sollte wieder das Testprojekt verknüpft werden, damit spätere Entwicklungsbefehle standardmäßig sicher gegen Test laufen.

```powershell
supabase link --project-ref tyoffdgeercbkpbdswxh
```

## 5. Neue Migration erstellen und lokal prüfen

Eine neue Änderung erhält immer eine neue Migrationsdatei:

```powershell
$MigrationName = "add_example_column"
supabase migration new $MigrationName

$MigrationFile = Get-ChildItem .\supabase\migrations -Filter "*_$MigrationName.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
notepad $MigrationFile.FullName
```

Beispiel:

```sql
alter table public.activities
  add column if not exists example_column text;
```

Prüfung gegen die lokale, aus allen Migrationen neu aufgebaute Datenbank:

```powershell
git diff -- .\supabase\migrations
supabase start                 # falls der lokale Stack noch nicht läuft
supabase db reset --local
npm run typecheck
npm run lint
npm test
npm run build
```

Bei Datenmigrationen zusätzlich Testdaten gezielt vorbereiten und den erwarteten Vorher-/Nachher-Zustand dokumentieren. Breite `update`, `delete`, `drop` oder nicht rückgängig zu machende Umbauten benötigen vor dem Produktionsschritt ein Backup und eine fachliche Freigabe.

## 6. Workflow für Testdatenbank und Pull Request

Dieser Ablauf gilt für Feature- und Staging-Branches:

```powershell
# 1. Branch und lokale Prüfungen
git branch --show-current
supabase db reset --local
npm test

# 2. Ausschliesslich Testprojekt verknüpfen
supabase link --project-ref <test-project-ref>
supabase migration list --linked

# 3. Geplante Änderungen prüfen und in Test pushen
supabase db push --dry-run
supabase db push
supabase migration list --linked

# 4. Anwendung mit .env.local (Testdatenbank) fachlich prüfen
npm run dev

# 5. Versionieren und PR nach main erstellen
git add .\supabase\migrations
git add <weitere-betroffene-dateien>
git diff --cached
git commit -m "Add example database migration"
git push -u origin <feature-branch>
```

In der Testdatenbank werden Migrationen aus mehreren Branches dauerhaft in der Historie stehen können. Daher:

- Eine bereits in der Testdatenbank ausgeführte Migration nicht umschreiben.
- Bei Änderungen eine neue Korrektur-Migration erstellen.
- Vor dem Produktiv-Push sicherstellen, dass die komplette Migrationshistorie aus `main` vorhanden ist.
- Testdaten dürfen nach Bedarf bereinigt oder neu aufgebaut werden; die Produktionsdatenbank nie zu Testzwecken verwenden.

## 7. Produktionsworkflow nach Merge nach `main`

Der Produktions-Push erfolgt erst, nachdem der Pull Request geprüft und nach `main` gemergt wurde.

```powershell
# 1. Aktuellen main holen und Status prüfen
git switch main
git pull --ff-only origin main
git status --short --branch
git branch --show-current

# 2. Optional, bei Daten- oder Strukturmigration: Produktionsbackup erstellen
New-Item -ItemType Directory -Force .\backups | Out-Null
$BackupFile = ".\backups\pre_production_migration_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# 3. Erst jetzt Produktionsprojekt verknüpfen und Status lesen
supabase link --project-ref <production-project-ref>
supabase migration list --linked

# 4. Dry Run sorgfältig mit den erwarteten Migrationen vergleichen
supabase db push --dry-run

# 5. Bei erforderlichem Backup ausführen; Dumps nicht committen
supabase db dump --linked --file $BackupFile
Get-Item $BackupFile

# 6. Migration produktiv anwenden und Status erneut prüfen
supabase db push
supabase migration list --linked

# 7. Produktive fachliche Stichprobe und Logs prüfen

# 8. Standardziel zurück auf Test setzen
supabase link --project-ref <test-project-ref>
```

Bei reinen SQL-/Policy-/Funktionsmigrationen kann das Backup nach Risikobewertung entfallen. Bei Tabellenumbauten oder Datenänderungen ist es verpflichtend. Den lokalen Ordner `backups/` in `.gitignore` halten.

## 8. Korrektur einer bereits angewendeten Migration

Eine Migration kann in Test oder Produktion bereits angewendet sein. Ihre SQL-Datei darf dann nicht geändert werden.

```powershell
supabase migration new fix_previous_schema_change
```

Die Korrektur wird zuerst lokal getestet, dann in die Testdatenbank gepusht und nach dem Merge nach `main` in Produktion ausgerollt. `supabase migration repair` ist kein normaler Korrekturmechanismus: Es ändert nur die Migrationshistorie und darf ausschließlich nach genauer Prüfung von Schema und Historie verwendet werden.

## 9. Häufige Fehler

| Fehlerbild | Ursache | Vorgehen |
| --- | --- | --- |
| Falscher Branch vor `db push` | Test- und Produktionsablauf wurden vermischt | Push abbrechen; Branch wechseln und das Zielprojekt erneut mit `supabase link` setzen. |
| Falsches Linked Project | Die CLI merkt sich das zuletzt verknüpfte Projekt | Vor jedem Remote-Push `supabase link --project-ref ...` und `migration list --linked` ausführen. |
| `.env.local` zeigt auf Produktion | Lokale App arbeitet gegen reale Daten | Sofort auf Testwerte ändern; lokale Tests erst danach fortsetzen. |
| Migration wurde in Test bereits angewendet | SQL-Datei wurde nach dem Test geändert | Alte Datei zurück auf den getesteten Stand bringen und eine neue Korrektur-Migration erstellen. |
| `Remote migration versions not found in local migrations directory` | Branch enthält nicht die vollständige Historie des Zielprojekts | Nicht reparieren oder pushen; erst `git fetch`, Branch/PR und Migrationsreihenfolge klären. |
| `Docker is not running` | Lokaler Supabase-Stack ist nicht gestartet | Docker Desktop starten, `supabase start` und anschließend `supabase db reset --local`. |

### TypeScript-Fehler nach Branchwechsel

Wenn nach einem Wechsel zwischen `staging` und `main` bei `npm run typecheck`
Fehler wie `Cannot find module ... app/api/ciclamino/...` oder
`app/api/azzurra/...` auftreten, stammen diese normalerweise nicht aus einer
Supabase-Migration. Next.js speichert generierte Routentypen in `.next/types`;
diese können noch auf Routen des zuvor ausgecheckten Branches verweisen.

Den lokalen Build-Cache löschen und die Typprüfung erneut ausführen:

```powershell
Remove-Item -Recurse -Force .next
npm run typecheck
```

`.next` ist ein lokales, generiertes Verzeichnis und darf nicht committed
werden. Erst wenn der Fehler danach weiter besteht, betrifft er tatsächlich
fehlende oder inkonsistente Quelldateien.

## 10. Checkliste vor einem Push

| Prüfschritt | Testdatenbank | Produktion |
| --- | --- | --- |
| korrekter Branch | Feature/Staging | `main` |
| `git status` geprüft | ja | ja |
| `supabase db reset --local` erfolgreich | ja | ja, vor dem Merge bzw. Ausrollen |
| `supabase link` explizit gesetzt | Testprojekt | Produktionsprojekt |
| `supabase migration list --linked` plausibel | ja | ja |
| `supabase db push --dry-run` geprüft | ja | ja |
| fachliche Prüfung | Test-App mit Testdaten | Produktions-App / Monitoring |
| Backup | optional nach Risiko | verpflichtend bei Daten-/Strukturmigration |
| Ziel wieder auf Test zurückgestellt | n. a. | ja |

Weiterführende Referenzen: [Supabase CLI](https://supabase.com/docs/reference/cli) und [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations).

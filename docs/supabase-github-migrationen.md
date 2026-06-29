# Supabase- und GitHub-Push fuer Datenbankmigrationen

Ziel dieser Anleitung: Eine neue oder geaenderte Supabase-Migration sauber pruefen, in die verknuepfte Supabase-Datenbank pushen und anschliessend nach GitHub versionieren.

Diese Anleitung ist fuer PowerShell unter Windows und dieses Repository gedacht:

```powershell
Set-Location "C:\Users\Fri\Documents\ZGB Strava Rangliste"
```

## Grundregeln

| Regel                                                            | Bedeutung                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Neue fachliche DB-Aenderung = neue Migration                     | Bereits remote angewendete Migrationen nicht nachtraeglich inhaltlich aendern. |
| Erst lokal pruefen, dann remote pushen                           | Fehler sollen vor `supabase db push` sichtbar werden.                          |
| Supabase-Push und GitHub-Push getrennt betrachten                | `supabase db push` aendert die Datenbank. `git push` versioniert nur Dateien.  |
| Vor produktiven Struktur- oder Datenmigrationen Backup erstellen | Besonders bei `alter table`, `drop`, `delete`, `update` ohne klare Begrenzung. |
| Keine Secrets committen                                          | `.env.local`, Tokens, Service Role Keys und Passwoerter bleiben lokal.         |
| Rueckrollen erfolgt ueber neue Korrektur-Migration               | Supabase-Migrationen sind keine automatisch reversiblen Down-Migrations.       |

## Begriffe

| Begriff           | Bedeutung                                                                          |
| ----------------- | ---------------------------------------------------------------------------------- |
| Lokale Migration  | SQL-Datei unter `supabase/migrations/*.sql`.                                       |
| Remote Migration  | Migration, die in der verknuepften Supabase-Datenbank als angewendet markiert ist. |
| Linked Project    | Das Supabase-Projekt, mit dem die lokale CLI verbunden ist.                        |
| Migration Version | Zeitstempel am Anfang des Dateinamens, z. B. `20260629100000`.                     |

## Entscheidung: neue oder bestehende Migration?

| Situation                                                    | Vorgehen                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Migration wurde noch nicht remote gepusht                    | Datei darf korrigiert werden. Danach erneut lokal pruefen.                     |
| Migration wurde bereits remote gepusht                       | Nicht mehr aendern. Neue Korrektur-Migration erstellen.                        |
| Unsicher, ob Migration remote angewendet wurde               | Mit `supabase migration list --linked` pruefen.                                |
| Migration ist nur lokal fehlerhaft und noch nicht angewendet | Datei korrigieren oder neu erzeugen.                                           |
| Produktivdaten muessen angepasst werden                      | Explizite Datenmigration schreiben, vorher Backup, danach Stichproben pruefen. |

## 1. Arbeitsstand pruefen

```powershell
# In das Repository wechseln
Set-Location "C:\Users\Fri\Documents\ZGB Strava Rangliste"

# Aktuellen Branch und Aenderungen anzeigen
git status --short --branch

# Remote-Ziel pruefen
git remote -v

# Aktuellen Branch anzeigen
git branch --show-current
```

Erwartung fuer dieses Projekt:

```text
Branch: main
Remote: origin -> https://github.com/fritz24stb-source/ZGB-Maglia-Rosa.git
```

Wenn der Arbeitsbaum bereits Aenderungen enthaelt, zuerst klaeren, ob sie zur Migration gehoeren:

```powershell
# Alle Datei-Aenderungen anzeigen
git diff

# Nur Migrationen anzeigen
git diff -- .\supabase\migrations

# Bereits gestagte Aenderungen anzeigen
git diff --cached
```

## 2. Supabase-CLI pruefen

Empfohlene Varianten:

| Variante                           | PowerShell-Aufruf  | Bemerkung                                                            |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------- |
| Ohne Installation im Projekt       | `npx supabase ...` | Offiziell unterstuetzt, benoetigt Node.js 20 oder neuer.             |
| Als Dev-Dependency im Projekt      | `npx supabase ...` | Reproduzierbarer, weil die CLI-Version in `package-lock.json` steht. |
| Globale CLI ueber Scoop/Standalone | `supabase ...`     | Praktisch, wenn sauber installiert.                                  |

Hinweis: Eine globale Installation per `npm install -g supabase` wird von Supabase offiziell nicht unterstuetzt. Wenn `supabase` auf dem Rechner bereits funktioniert, kann es genutzt werden. Andernfalls ist `npx supabase ...` die robustere Variante.

Globale CLI pruefen:

```powershell
# Pruefen, ob supabase gefunden wird
Get-Command supabase

# Version anzeigen
supabase --version
```

Alternative ohne globale Installation:

```powershell
# Pruefen, ob npx vorhanden ist
Get-Command npx

# Supabase-CLI ueber npx ausfuehren
npx supabase --version
```

Optionale lokale Installation als Dev-Dependency:

```powershell
# Supabase-CLI im Projekt versionieren
npm install --save-dev supabase

# Danach ueber npx ausfuehren
npx supabase --version
```

Wenn in dieser Anleitung `supabase ...` steht, kann bei fehlender globaler CLI stattdessen immer `npx supabase ...` verwendet werden.

Hinweis: In gesperrten Umgebungen kann die Supabase-CLI beim ersten Start in `C:\Users\<Benutzer>\.supabase` schreiben wollen. Wenn das durch Berechtigungen blockiert ist, den Befehl in einer normalen PowerShell des Benutzers ausfuehren, Schreibrechte fuer dieses Verzeichnis pruefen oder Telemetry fuer die aktuelle Sitzung deaktivieren:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = "1"
npx supabase --version
```

## 3. Supabase-Login und Projekt-Link pruefen

```powershell
# Login starten, falls noch kein Supabase-Token hinterlegt ist
supabase login

# Projekt-Link pruefen
supabase projects list

# Falls das Repository noch nicht verlinkt ist:
supabase link --project-ref <project-ref>

# Migration-Status zwischen lokal und remote anzeigen
supabase migration list --linked
```

`<project-ref>` ist die Projektkennung aus der Supabase-URL:

```text
https://<project-ref>.supabase.co
```

Bei automatisierten Umgebungen kann statt interaktivem Login ein Access Token gesetzt werden:

```powershell
# Nur fuer die aktuelle PowerShell-Sitzung
$env:SUPABASE_ACCESS_TOKEN = "<supabase-access-token>"

# Danach CLI-Befehl ausfuehren
supabase projects list
```

Wichtig: Den Access Token nicht in `.env.local`, Markdown-Dateien oder Git committen.

## 4. Neue Migration erstellen

Fuer eine neue Datenbankaenderung:

```powershell
# Aussagekraeftigen Namen setzen, englisch und klein geschrieben
$MigrationName = "add_example_column"

# Neue Migration erzeugen
supabase migration new $MigrationName

# Neueste erzeugte Migrationsdatei finden
$MigrationFile = Get-ChildItem .\supabase\migrations -Filter "*_$MigrationName.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

# Pfad anzeigen
$MigrationFile.FullName

# Datei mit Notepad oeffnen
notepad $MigrationFile.FullName
```

Beispiel fuer eine einfache Strukturmigration:

```sql
alter table public.activities
  add column if not exists example_column text;
```

Beispiel fuer eine abgesicherte Datenmigration:

```sql
update public.activities
set source = 'manual'
where source is null
  and manual_entry_key is not null;
```

Fachliche Hinweise:

| Thema               | Empfehlung                                                                       |
| ------------------- | -------------------------------------------------------------------------------- |
| Tabellen            | Schema immer explizit angeben, z. B. `public.activities`.                        |
| Neue Spalten        | Wenn moeglich erst nullable oder mit Default einfuehren.                         |
| Constraints         | Bei bestehenden Daten vorher pruefen, ob alle Zeilen die Bedingung erfuellen.    |
| RLS                 | Neue Tabellen nicht ohne aktivierte RLS und Policies produktiv nutzen.           |
| Funktionen          | `create or replace function` verwenden, wenn bestehende Funktion angepasst wird. |
| Datenupdates        | Immer mit enger `where`-Bedingung schreiben.                                     |
| Destruktive Befehle | `drop`, `delete`, breite `update` nur mit Backup und gezielter Pruefung.         |

## 5. Bestehende Migration aendern

Nur erlaubt, wenn die Migration noch nicht remote angewendet wurde.

Pruefung:

```powershell
# Lokale und remote Migrationshistorie anzeigen
supabase migration list --linked
```

Wenn die Migration remote bereits als angewendet gelistet ist:

```powershell
# Neue Korrektur-Migration erstellen
supabase migration new fix_previous_migration
```

Dann die Korrektur als neue SQL-Datei schreiben. Nicht die alte Datei veraendern.

Wenn die Migration noch nicht remote angewendet wurde:

```powershell
# Datei oeffnen und korrigieren
notepad .\supabase\migrations\<timestamp>_<name>.sql

# Geaenderte Migration anzeigen
git diff -- .\supabase\migrations\<timestamp>_<name>.sql
```

## 6. Lokale Pruefung vor dem Supabase-Push

Empfohlene Reihenfolge:

```powershell
# SQL-Dateien und sonstige Aenderungen ansehen
git diff

# Nur Migrationsaenderungen ansehen
git diff -- .\supabase\migrations

# Migrationen lokal gegen eine frische lokale DB anwenden
supabase db reset --local

# Anwendung formatieren
npm run format

# TypeScript pruefen
npm run typecheck

# ESLint pruefen
npm run lint

# Tests ausfuehren
npm test

# Produktionsbuild pruefen
npm run build
```

Kommentare zum Ablauf:

| Schritt                     | Zweck                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `git diff`                  | Sichtkontrolle, ob nur gewollte Aenderungen enthalten sind.                                                     |
| `supabase db reset --local` | Baut die lokale Datenbank aus allen Migrationen neu auf. Syntaxfehler und Reihenfolgeprobleme fallen frueh auf. |
| `npm run typecheck`         | Erkennt TypeScript-Fehler nach Schema-/Typaenderungen.                                                          |
| `npm run lint`              | Erkennt Stil- und Qualitaetsprobleme.                                                                           |
| `npm test`                  | Prueft fachliche Logik.                                                                                         |
| `npm run build`             | Prueft, ob die App produktionsfaehig baut.                                                                      |

Wenn lokal kein Supabase-Stack laeuft:

```powershell
# Docker Desktop starten, danach lokalen Supabase-Stack starten
supabase start

# Danach Reset erneut ausfuehren
supabase db reset --local
```

Warnung: Fuer lokale Pruefung explizit `--local` verwenden. Keine Reset-Befehle gegen produktive Datenbanken ausfuehren.

## 7. Optional: Backup vor produktivem DB-Push

Bei reinen View-, Function- oder Policy-Aenderungen ist ein Backup oft nicht zwingend. Bei Tabellenumbauten und Datenupdates ist es sinnvoll.

```powershell
# Backup-Ordner erstellen
New-Item -ItemType Directory -Force .\backups | Out-Null

# Dateiname mit Zeitstempel
$BackupFile = ".\backups\pre_migration_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Remote-Datenbank dumpen
supabase db dump --linked --file $BackupFile

# Backup-Datei pruefen
Get-Item $BackupFile
```

Backup-Dateien koennen gross werden und gehoeren in der Regel nicht nach Git. Wenn der Ordner `backups` regelmaessig genutzt wird, sollte er in `.gitignore` aufgenommen werden.

## 8. Migration gegen Supabase pruefen und pushen

Zuerst anzeigen, was aus Sicht der CLI noch offen ist:

```powershell
# Lokalen und remote Migrationsstand vergleichen
supabase migration list --linked
```

Dry Run:

```powershell
# Anzeigen, welche Migrationen gepusht wuerden
supabase db push --dry-run
```

Wenn der Dry Run plausibel ist:

```powershell
# Offene lokale Migrationen in die verknuepfte Supabase-Datenbank pushen
supabase db push
```

Nach dem Push:

```powershell
# Migrationsstatus erneut pruefen
supabase migration list --linked
```

Falls der Push eine Passwortabfrage oder Netzwerkverbindung benoetigt, PowerShell offen lassen und die Rueckfrage beantworten.

## 9. Fachliche Pruefung nach Supabase-Push

Je nach Migration:

```powershell
# App lokal starten
npm run dev
```

Dann pruefen:

```text
http://127.0.0.1:3000/leaderboard
```

Zusaetzliche Pruefungen:

| Migrationstyp     | Pruefung                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| Neue Spalte       | App liest/schreibt weiterhin korrekt.                                  |
| Neue Tabelle      | RLS aktiv, Policies greifen.                                           |
| Neue Policy       | Zugriff mit anon/authenticated/service role wie erwartet.              |
| Neue Function/RPC | API-Endpunkt oder SQL-Aufruf liefert erwartetes Ergebnis.              |
| Datenmigration    | Stichproben in Supabase Table Editor oder SQL Editor pruefen.          |
| Index             | Query weiterhin korrekt, Performance bei Bedarf mit `explain` pruefen. |

## 10. Git-Commit vorbereiten

Nach erfolgreichem Supabase-Push und fachlicher Pruefung:

```powershell
# Arbeitsstand anzeigen
git status --short

# Aenderungen kontrollieren
git diff

# Nur relevante Dateien stagen
git add .\supabase\migrations
git add .\docs

# Falls Code oder Tests angepasst wurden, gezielt hinzufuegen
git add .\app .\components .\lib .\tests .\types

# Falls supabase als Dev-Dependency installiert wurde
git add .\package.json .\package-lock.json

# Staging pruefen
git diff --cached
```

Wenn nur eine konkrete Migrationsdatei gestaged werden soll:

```powershell
git add .\supabase\migrations\<timestamp>_<name>.sql
```

Wenn versehentlich zu viel gestaged wurde:

```powershell
# Datei aus Staging entfernen, Arbeitskopie bleibt erhalten
git restore --staged <dateipfad>
```

Wenn lokale Supabase-Cachedateien geaendert wurden:

```powershell
# Erst pruefen
git diff -- .\supabase\.temp

# Nur wenn die Aenderung eindeutig nicht versioniert werden soll:
git restore -- .\supabase\.temp
```

Hinweis: In diesem Repository sind aktuell Dateien unter `supabase/.temp` versioniert. Deshalb nicht blind loeschen oder zuruecksetzen, sondern vorher mit `git diff` pruefen.

## 11. Commit erstellen

```powershell
# Commit mit konkreter Aussage erstellen
git commit -m "Add example database migration"
```

Beispiele fuer Commit-Messages:

```text
Add public leaderboard access migration
Fix activity distance migration
Add manual entry policy migration
Update leaderboard RPC migration
```

Wenn Git keinen Commit erstellt:

```powershell
# Pruefen, ob ueberhaupt etwas gestaged ist
git status --short

# Gestagte Aenderungen anzeigen
git diff --cached
```

## 12. Nach GitHub pushen

```powershell
# Aktuellen Branch pruefen
git branch --show-current

# Nach GitHub pushen
git push origin main
```

Wenn auf einem Feature-Branch gearbeitet wird:

```powershell
# Branch anzeigen
git branch --show-current

# Aktuellen Branch nach origin pushen
git push -u origin <branch-name>
```

Nach dem Push:

```powershell
# Status muss sauber sein
git status --short --branch
```

Erwartung:

```text
## main...origin/main
```

Ohne weitere Datei-Aenderungen darunter.

## 13. Kompletter Standardablauf

Dieser Ablauf ist der Normalfall fuer eine neue Migration.

```powershell
# 1. Repository oeffnen
Set-Location "C:\Users\Fri\Documents\ZGB Strava Rangliste"

# 2. Ausgangszustand pruefen
git status --short --branch
git remote -v

# 3. Supabase-Verbindung pruefen
supabase migration list --linked

# 4. Neue Migration erzeugen
$MigrationName = "add_example_column"
supabase migration new $MigrationName
$MigrationFile = Get-ChildItem .\supabase\migrations -Filter "*_$MigrationName.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
notepad $MigrationFile.FullName

# 5. Aenderungen pruefen
git diff -- .\supabase\migrations

# 6. Lokal testen
supabase db reset --local
npm run format
npm run typecheck
npm run lint
npm test
npm run build

# 7. Optionales Backup bei riskanten Migrationen
New-Item -ItemType Directory -Force .\backups | Out-Null
$BackupFile = ".\backups\pre_migration_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
supabase db dump --linked --file $BackupFile

# 8. Supabase-Push
supabase db push --dry-run
supabase db push
supabase migration list --linked

# 9. Fachlich pruefen
npm run dev

# 10. Git vorbereiten
git status --short
git diff
git add .\supabase\migrations
git add .\docs
git diff --cached

# 11. Commit und GitHub-Push
git commit -m "Add example database migration"
git push origin main

# 12. Abschlusskontrolle
git status --short --branch
```

## 14. Ablauf fuer eine Korrektur an bereits gepushter Migration

Nicht die alte Migration aendern. Neue Korrektur-Migration schreiben.

```powershell
# 1. Status pruefen
Set-Location "C:\Users\Fri\Documents\ZGB Strava Rangliste"
supabase migration list --linked

# 2. Neue Korrektur-Migration erzeugen
supabase migration new fix_previous_schema_change

# 3. Datei oeffnen und Korrektur-SQL schreiben
$MigrationFile = Get-ChildItem .\supabase\migrations -Filter "*_fix_previous_schema_change.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
notepad $MigrationFile.FullName

# 4. Lokal pruefen
supabase db reset --local
npm run typecheck
npm run lint
npm test
npm run build

# 5. Remote pruefen und pushen
supabase db push --dry-run
supabase db push
supabase migration list --linked

# 6. GitHub versionieren
git add .\supabase\migrations
git commit -m "Fix previous database migration"
git push origin main
```

## 15. Typische Fehler und Loesungen

| Fehlerbild                                                             | Wahrscheinliche Ursache                                                       | Loesung                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase : The term 'supabase' is not recognized`                     | Supabase-CLI nicht global installiert oder nicht im PATH.                     | `npx supabase ...` verwenden oder `npm install --save-dev supabase` im Projekt ausfuehren und danach weiter mit `npx supabase ...`.                                     |
| `npx : The term 'npx' is not recognized`                               | Node.js/npm fehlt oder PATH ist defekt.                                       | Node.js installieren oder PATH reparieren, danach `Get-Command npm` und `Get-Command npx` pruefen.                                                                      |
| `You are not logged in` oder Login-Fehler                              | Kein Supabase Access Token vorhanden.                                         | `supabase login` ausfuehren oder `$env:SUPABASE_ACCESS_TOKEN` setzen.                                                                                                   |
| `Project not linked`                                                   | Lokales Repository ist nicht mit Supabase-Projekt verbunden.                  | `supabase link --project-ref <project-ref>` ausfuehren.                                                                                                                 |
| `failed to connect to postgres`                                        | Netzwerk, Passwort, Pooler oder Projektstatus problematisch.                  | Internet pruefen, Supabase-Projektstatus pruefen, erneut anmelden, `supabase migration list --linked` testen.                                                           |
| `Docker is not running`                                                | Lokale Supabase-DB benoetigt Docker.                                          | Docker Desktop starten, dann `supabase start` und `supabase db reset --local`.                                                                                          |
| `relation already exists`                                              | Migration erstellt Objekt ohne Schutz oder Objekt existiert bereits.          | SQL mit `if not exists` absichern oder Korrektur-Migration schreiben.                                                                                                   |
| `column already exists`                                                | Spalte existiert bereits remote oder lokal.                                   | `add column if not exists` verwenden oder Migration-Historie pruefen.                                                                                                   |
| `permission denied for schema public`                                  | Rolle hat nicht die noetigen Rechte oder RLS/Grants fehlen.                   | Grants, Policies und Funktionsrechte in Migration ergaenzen.                                                                                                            |
| `new row violates row-level security policy`                           | RLS-Policy blockiert Insert/Update.                                           | Policy fuer konkrete Rolle und Operation pruefen, nicht pauschal RLS deaktivieren.                                                                                      |
| `violates foreign key constraint`                                      | Datenmigration referenziert fehlende Datensaetze.                             | Datenbestand vorher pruefen, Reihenfolge korrigieren, fehlende Referenzen sauber anlegen.                                                                               |
| `violates not-null constraint`                                         | Bestehende Zeilen haben keinen Wert fuer neue Pflichtspalte.                  | Erst nullable einfuehren, Daten befuellen, danach `set not null` in separater Migration.                                                                                |
| `duplicate key value violates unique constraint`                       | Datenmigration erzeugt Duplikate.                                             | Vorher Duplikate ermitteln, Bereinigung oder `on conflict` verwenden.                                                                                                   |
| `syntax error at or near ...`                                          | SQL-Syntaxfehler.                                                             | Datei oeffnen, Zeile korrigieren, lokal mit `supabase db reset --local` erneut pruefen.                                                                                 |
| `prepared statement ... already exists`                                | Verbindungs-/Poolerproblem bei wiederholter Ausfuehrung.                      | Befehl erneut ausfuehren, ggf. PowerShell neu starten.                                                                                                                  |
| `Remote migration versions not found in local migrations directory`    | Remote kennt Migrationen, die lokal fehlen.                                   | Nicht blind reparieren. Erst `git pull`, Branch pruefen, dann `supabase migration list --linked`.                                                                       |
| `Local migration versions not found in remote database`                | Lokale Migrationen sind noch nicht gepusht.                                   | `supabase db push --dry-run`, dann `supabase db push`.                                                                                                                  |
| `Found local migration files to be inserted before the last migration` | Zeitstempel einer neuen Migration liegt vor bereits angewendeten Migrationen. | Neue Migration mit aktuellem Zeitstempel erzeugen. Alte Datei nur verwenden, wenn sie sicher noch nicht remote angewendet wurde.                                        |
| `supabase migration repair` falsch genutzt                             | Migrationshistorie wurde manuell markiert, Schema aber nicht angepasst.       | Repair nur fuer Historienkorrektur nutzen. Schema separat per SQL/Korrektur-Migration pruefen.                                                                          |
| `git push rejected`                                                    | Remote enthaelt neue Commits.                                                 | `git pull --rebase origin main`, Konflikte loesen, Tests erneut ausfuehren, dann `git push origin main`.                                                                |
| `non-fast-forward`                                                     | Lokaler Branch ist hinter `origin/main`.                                      | `git fetch origin`, `git status`, dann `git pull --rebase origin main`.                                                                                                 |
| Merge-Konflikt in Migrationen                                          | Zwei Aenderungen betreffen Migrationen oder Reihenfolge.                      | Beide Migrationen erhalten, Reihenfolge nach Zeitstempel pruefen, lokal `supabase db reset --local`.                                                                    |
| `nothing to commit, working tree clean`                                | Keine gestagten oder keine geaenderten Dateien.                               | `git status --short` und `git diff` pruefen.                                                                                                                            |
| `Author identity unknown`                                              | Git-Name oder E-Mail nicht konfiguriert.                                      | `git config --global user.name "Name"` und `git config --global user.email "mail@example.com"`.                                                                         |
| `EPERM ... C:\Users\<Benutzer>\.supabase\telemetry...`                 | CLI kann lokale Supabase-Konfiguration/Telemetry nicht schreiben.             | Normale Benutzer-PowerShell verwenden, Schreibrechte auf `C:\Users\<Benutzer>\.supabase` pruefen oder fuer die Sitzung `$env:SUPABASE_TELEMETRY_DISABLED = "1"` setzen. |

## 16. Befehle zur Fehleranalyse

Git:

```powershell
# Remote-Stand holen, ohne zu mergen
git fetch origin

# Lokalen Stand mit Remote vergleichen
git status --short --branch

# Commits anzeigen, die lokal noch nicht auf origin/main sind
git log --oneline origin/main..HEAD

# Commits anzeigen, die remote noch nicht lokal sind
git log --oneline HEAD..origin/main

# Geaenderte Dateien anzeigen
git diff --name-status

# Gestagte Dateien anzeigen
git diff --cached --name-status
```

Supabase:

```powershell
# Migrationsstand lokal/remote
supabase migration list --linked

# Geplanten Push anzeigen
supabase db push --dry-run

# Lokale Datenbank vollstaendig aus Migrationen neu aufbauen
supabase db reset --local

# Projektliste pruefen
supabase projects list
```

PowerShell:

```powershell
# Aktuelles Verzeichnis
Get-Location

# Migrationsdateien nach Datum anzeigen
Get-ChildItem .\supabase\migrations | Sort-Object Name

# Neueste Migration anzeigen
Get-ChildItem .\supabase\migrations |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
```

## 17. Migration-Historie reparieren

Nur nutzen, wenn sicher ist, dass Schema und Historie auseinanderlaufen. `migration repair` aendert die Migrationshistorie, ersetzt aber keine fehlenden SQL-Aenderungen.

Beispiele:

```powershell
# Status pruefen
supabase migration list --linked

# Eine Version remote als angewendet markieren
supabase migration repair <version> --status applied

# Eine Version remote als nicht mehr angewendet markieren
supabase migration repair <version> --status reverted

# Danach erneut pruefen
supabase migration list --linked
```

Risiko:

| Problem                                                      | Konsequenz                                               |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| Migration als `applied` markiert, SQL aber nicht ausgefuehrt | Supabase fuehrt sie nicht mehr aus, obwohl Schema fehlt. |
| Migration als `reverted` markiert, Schema aber vorhanden     | Naechster Push kann an vorhandenen Objekten scheitern.   |
| Repair ohne Backup                                           | Historie wird schwer nachvollziehbar.                    |

Empfehlung: Vor `migration repair` immer `supabase migration list --linked`, `git status`, betroffene SQL-Datei und Remote-Schema pruefen.

## 18. Rollback-Strategie

Wenn `supabase db push` bereits erfolgreich war, nicht versuchen, die alte Migration aus Git zu loeschen und erneut zu pushen. Stattdessen:

```powershell
# Neue Korrektur-Migration erstellen
supabase migration new rollback_or_fix_<kurze_beschreibung>

# Korrektur schreiben
$MigrationFile = Get-ChildItem .\supabase\migrations -Filter "*_rollback_or_fix_<kurze_beschreibung>.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
notepad $MigrationFile.FullName

# Lokal testen
supabase db reset --local
npm test
npm run build

# Remote pushen
supabase db push --dry-run
supabase db push

# Versionieren
git add .\supabase\migrations
git commit -m "Fix database migration issue"
git push origin main
```

Beispiele fuer Korrektur-SQL:

```sql
-- Spalte wieder entfernen, wenn sie wirklich nicht genutzt wird
alter table public.activities
  drop column if exists example_column;
```

```sql
-- Policy korrigieren
drop policy if exists "Allow public leaderboard read" on public.activities;

create policy "Allow public leaderboard read"
on public.activities
for select
to anon, authenticated
using (status = 'active');
```

## 19. Abschluss-Checkliste

| Pruefung                                                                                | Erledigt |
| --------------------------------------------------------------------------------------- | -------- |
| `git status --short --branch` vor Beginn geprueft                                       |          |
| Neue Migration erstellt oder alte nur dann geaendert, wenn noch nicht remote angewendet |          |
| SQL fachlich kontrolliert                                                               |          |
| `supabase db reset --local` erfolgreich                                                 |          |
| `npm run typecheck` erfolgreich                                                         |          |
| `npm run lint` erfolgreich                                                              |          |
| `npm test` erfolgreich                                                                  |          |
| `npm run build` erfolgreich                                                             |          |
| Bei riskanter Migration Backup erstellt                                                 |          |
| `supabase db push --dry-run` plausibel                                                  |          |
| `supabase db push` erfolgreich                                                          |          |
| Fachliche Stichprobe in App oder Supabase durchgefuehrt                                 |          |
| Nur relevante Dateien gestaged                                                          |          |
| Commit erstellt                                                                         |          |
| `git push origin main` erfolgreich                                                      |          |
| `git status --short --branch` sauber                                                    |          |

## 20. Offizielle Referenzen

- Supabase CLI Reference: <https://supabase.com/docs/reference/cli>
- Supabase Database Migrations: <https://supabase.com/docs/guides/deployment/database-migrations>
- Git `push`: <https://git-scm.com/docs/git-push>
- GitHub: Pushing commits to a remote repository: <https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository>

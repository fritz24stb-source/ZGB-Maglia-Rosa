# Betriebsannahmen

Zielbetrieb für das MVP:

- ca. 70 registrierte Vereinsmitglieder
- ca. 30 bis 40 neue Strava-Aktivitäten pro Woche
- wenige hundert Leaderboard-Aufrufe pro Woche
- Deployment zunächst auf Vercel Hobby und Supabase Free

## Sync-Strategie

Strava Webhooks sind der primäre Sync-Mechanismus. Pro Webhook-Event wird das Event schnell in `webhook_events` gespeichert, mit `200 OK` bestätigt und danach die betroffene Aktivität nachgeladen, bewertet und per `strava_activity_id` idempotent gespeichert.

Der tägliche Vercel Cron `/api/cron/strava` übernimmt drei Wartungsaufgaben:

- Strava Push Subscription anlegen oder bei falscher Callback-URL ersetzen
- pending/failed Webhook-Events nachverarbeiten
- kleinen Backfill für aktive Mitglieder in der aktiven Saison ausführen

Häufigere oder größere Fallback-Syncs setzen eine andere Betriebsvariante voraus:

- Supabase Scheduled Functions
- GitHub Actions
- Cloudflare Workers Cron
- Vercel Pro Cron

## Datenbankzugriff

- Leaderboard-Daten werden über `public.get_leaderboard(...)` aggregiert.
- Seitenaufrufe dürfen keine Vollsynchronisation auslösen.
- Strava-Tokens liegen in `public.strava_connections`, sind aber für `authenticated` nur ohne Token-Spalten lesbar.
- Schreibende Sync-, OAuth- und manuelle Eingabeprozesse laufen serverseitig mit Service Role und eigener Validierung.
- RLS ist auf allen Anwendungstabellen aktiv.

## Rate-Limits

Die erwartete Last ist gering. Trotzdem gilt:

- Webhooks deduplizieren über `webhook_events_unique`.
- Aktivitäten deduplizieren über `activities_strava_activity_id_unique_idx`.
- Syncs sollen batched und sparsam laufen.
- Kein Polling bei jedem Seitenaufruf.

## Phasenabschluss und Erreichbarkeit

Nach jeder stabilen Entwicklungsphase muss der Stand gepusht und die App erreichbar geschaltet werden.

Pflichtschritte:

1. `npm run format`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`
5. `npm run build`
6. `git status`, Commit erstellen und `git push`
7. App starten oder Deployment prüfen
8. Erreichbarkeit von `/leaderboard` prüfen
9. Geprüfte URL im Abschlussbericht der Phase nennen

Für lokale Prüfung reicht eine erreichbare Vorschau unter `http://127.0.0.1:3000/leaderboard`. Für produktive Phasen ist die Vercel-URL zu prüfen.

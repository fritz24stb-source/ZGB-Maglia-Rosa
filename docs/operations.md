# Betriebsannahmen

Zielbetrieb fuer das MVP:

- ca. 70 registrierte Vereinsmitglieder
- ca. 30 bis 40 neue Strava-Aktivitaeten pro Woche
- wenige hundert Leaderboard-Aufrufe pro Woche
- Deployment zunaechst auf Vercel Hobby und Supabase Free

## Sync-Strategie

Strava Webhooks sind der primaere Sync-Mechanismus. Pro Webhook-Event wird das Event schnell in `webhook_events` gespeichert, mit `200 OK` bestaetigt und danach die betroffene Aktivitaet nachgeladen, bewertet und per `strava_activity_id` idempotent gespeichert.

Der taegliche Vercel Cron `/api/cron/strava` uebernimmt drei Wartungsaufgaben:

- Strava Push Subscription anlegen oder bei falscher Callback-URL ersetzen
- pending/failed Webhook-Events nachverarbeiten
- kleinen Backfill fuer aktive Mitglieder in der aktiven Saison ausfuehren

Haeufigere oder groessere Fallback-Syncs setzen eine andere Betriebsvariante voraus:

- Supabase Scheduled Functions
- GitHub Actions
- Cloudflare Workers Cron
- Vercel Pro Cron

## Datenbankzugriff

- Leaderboard-Daten werden ueber `public.get_leaderboard(...)` aggregiert.
- Seitenaufrufe duerfen keine Vollsynchronisation ausloesen.
- Strava-Tokens liegen in `public.strava_connections`, sind aber fuer `authenticated` nur ohne Token-Spalten lesbar.
- Schreibende Sync-, OAuth- und manuelle Eingabeprozesse laufen serverseitig mit Service Role und eigener Validierung.
- RLS ist auf allen Anwendungstabellen aktiv.

## Rate-Limits

Die erwartete Last ist gering. Trotzdem gilt:

- Webhooks deduplizieren ueber `webhook_events_unique`.
- Aktivitaeten deduplizieren ueber `activities_strava_activity_id_unique_idx`.
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
7. App starten oder Deployment pruefen
8. Erreichbarkeit von `/leaderboard` pruefen
9. Gepruefte URL im Abschlussbericht der Phase nennen

Fuer lokale Pruefung reicht eine erreichbare Vorschau unter `http://127.0.0.1:3000/leaderboard`. Fuer produktive Phasen ist die Vercel-URL zu pruefen.

import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "FAQ | ZGB-Maglia-Rosa",
  description: "Antworten zur Strava-Verbindung, Wertung und manuellen Eingabe.",
};

const faqs = [
  {
    question: "Wie kann ich mein Strava verlinken?",
    answer: (
      <p>
        Melde dich an und öffne <Link href="/profile">Profil</Link>. Unter
        <strong> Strava-Verbindung</strong> wähle <strong>Strava verbinden</strong>
         und bestätige die Berechtigung bei Strava. Danach werden neue passende
        Aktivitäten automatisch für die Wertung synchronisiert.
      </p>
    ),
  },
  {
    question: "Wie muss meine Strava-Aktivität gekennzeichnet sein?",
    answer: (
      <div className="space-y-3">
        <p>
          Entscheidend sind der Aktivitätsname, der Starttag, die aktive Saison
          und gegebenenfalls weitere Bedingungen der Regel. Benenne die
          Aktivität passend zur Fahrt.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Fondo:</strong> Der Name enthält <em>Samstags</em>, <em>Fondo</em> oder <em>ZGB</em>; Start am Samstag oder Sonntag.</li>
          <li><strong>Zug:</strong> Der Name enthält <em>ZGB</em> oder <em>Zug</em>; Start am Mittwoch.</li>
          <li><strong>Scuola / Scuderia:</strong> Der Name enthält jeweils <em>ZGB</em> oder den passenden Begriff; Start am Mittwoch.</li>
        </ul>
        <p>
          Die Auswertung verwendet den in Strava gespeicherten Aktivitätsnamen
          und den lokalen Startzeitpunkt. Änderungen an einer Aktivität werden
          bei einer erneuten Synchronisation berücksichtigt.
        </p>
      </div>
    ),
  },
  {
    question: "Wie kann ich einen Passkey (Face ID oder Fingerabdruck) erstellen?",
    answer: (
      <p>
        Melde dich an, gehe zu <Link href="/profile">Profil</Link> und wähle im
        Abschnitt <strong>Passkeys</strong> die Schaltfläche
        <strong> Passkey erstellen</strong>. Bestätige anschließend Face ID,
        Fingerabdruck oder die Displaysperre deines Geräts. Voraussetzung ist
        ein passkey-fähiger Browser oder ein kompatibles Gerät.
      </p>
    ),
  },
  {
    question: "Wer kann meine Daten und Aktivitäten sehen?",
    answer: (
      <p>
        Im Leaderboard sehen Mitglieder nur deinen Namen, Punkte, die Anzahl
        gewerteter Fahrten sowie deren Kategorie. Die Details deiner eigenen
        Aktivitäten siehst nur du im Profil. Detaildaten anderer Mitglieder
        sind ausschließlich für Admins sichtbar, wenn sie eine Wertung prüfen
        oder korrigieren müssen. GPS-Tracks, Routen, Herzfrequenz- und
        Leistungsdaten werden weder angezeigt noch für die Wertung benötigt.
        Weitere Informationen stehen unter <Link href="/datenschutz">Datenschutz</Link>.
      </p>
    ),
  },
  {
    question: "Wie werden die Punkte verteilt?",
    answer: (
      <div className="space-y-3">
        <ul className="list-disc space-y-1 pl-5">
          <li>Fondo: 100 Punkte</li>
          <li>Zug, Scuola oder Scuderia: jeweils 70 Punkte</li>
          <li>Sonderevents: Punktzahl gemäß der jeweiligen Eventregel</li>
        </ul>
        <p>
          Pro Aktivität wird nur eine Regel gewertet. Treffen mehrere Regeln
          zu, hat ein passendes Sonderevent Vorrang; ansonsten entscheidet die
          hinterlegte Priorität. Nur Aktivitäten innerhalb der aktiven Saison
          erhalten Punkte.
        </p>
      </div>
    ),
  },
  {
    question: "Was ist mit Sonderevents?",
    answer: (
      <p>
        Sonderevents werden von den Admins mit Zeitraum, Name, Punktzahl und
        weiteren Kriterien angelegt. Trage den vorgegebenen Begriff im
        Aktivitätsnamen ein und beachte den Eventzeitraum. Erfüllt deine Fahrt
        die Sonderregel, wird diese vor einer passenden Standardregel gewertet.
      </p>
    ),
  },
  {
    question: "Wie kann ich meine Aktivität manuell hinzufügen?",
    answer: (
      <p>
        Öffne <Link href="/manual">Manuell</Link> und wähle eine aktuell
        offene Kategorie. Gib die geforderten Angaben ein und sende den Eintrag
        ab. Manuelle Einträge sind nur im jeweiligen Zeitfenster, innerhalb
        der aktiven Saison und in der Regel einmal pro Kategorie und Zeitfenster
        möglich. Sie werden direkt gewertet und für die Administration
        nachvollziehbar protokolliert.
      </p>
    ),
  },
  {
    question: "Meine Aktivität erscheint nicht im Leaderboard. Was kann ich tun?",
    answer: (
      <p>
        Prüfe zuerst, ob Strava im Profil verbunden ist, die Aktivität in der
        aktiven Saison liegt und Name sowie Starttag zur Regel passen. Gib der
        Synchronisation nach dem Speichern in Strava etwas Zeit. Fehlt die Fahrt
        danach weiterhin, nutze bei offenem Zeitfenster die manuelle Eingabe
        oder wende dich an einen Admin.
      </p>
    ),
  },
  {
    question: "Kann ich Strava wieder trennen oder meine Daten bereinigen?",
    answer: (
      <p>
        Ja. Im <Link href="/profile">Profil</Link> kannst du die
        Strava-Verbindung trennen oder die Strava-Daten bereinigen. Nach dem
        Trennen werden keine neuen Aktivitäten mehr synchronisiert. Für die
        Rangliste notwendige, aggregierte Wertungsdaten können erhalten
        bleiben; Details dazu findest du im <Link href="/datenschutz">Datenschutz</Link>.
      </p>
    ),
  },
] as const;

export default function FaqPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="FAQ"
        description="Antworten zu Strava, Wertung, Passkeys und manuellen Einträgen."
      />

      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex items-start gap-3">
          <CircleHelp aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-signal-blue" />
          <p className="text-sm leading-6 text-asphalt-600">
            Die angezeigten Wertungsregeln können je Saison oder bei
            Sonderevents angepasst werden. Maßgebend sind die aktuell
            hinterlegten Regeln.
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        {faqs.map((faq) => (
          <details key={faq.question} className="group rounded-lg border border-asphalt-200 bg-white shadow-line">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 text-base font-semibold text-asphalt-900 [&::-webkit-details-marker]:hidden">
              {faq.question}
              <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-asphalt-500 transition-transform group-open:rotate-45" />
            </summary>
            <div className="border-t border-asphalt-100 px-5 py-4 text-sm leading-6 text-asphalt-700">
              {faq.answer}
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}

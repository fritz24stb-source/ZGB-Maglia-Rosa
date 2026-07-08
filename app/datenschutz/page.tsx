import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Datenschutz | ZGB-Maglia-Rosa",
  description:
    "Datenschutzhinweise zur vereinsinternen Wertung ZGB-Maglia-Rosa.",
};

const processedData = [
  "Athlete ID",
  "Anzeigename",
  "Aktivitaets-ID",
  "Aktivitaetsname",
  "Sporttyp",
  "Distanz",
  "Startzeit",
  "Strava-URL",
  "Token-Metadaten, soweit sie fuer Verbindung und Synchronisation notwendig sind",
];

const purposes = [
  "OAuth-Verknuepfung mit dem Mitgliederprofil",
  "Synchronisation von Aktivitaeten",
  "Berechnung der vereinsinternen Punkte",
  "Nachvollziehbarkeit der Wertung",
  "Admin-Pruefung bei Korrekturen, Ausschluessen oder Re-Scoring",
];

export default function DatenschutzPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Datenschutz"
        description="Datenschutzhinweise fuer ZGB-Maglia-Rosa."
      />

      <section className="grid gap-6 text-sm leading-6 text-asphalt-700">
        <Article title="Zweck der Anwendung">
          <p>
            ZGB-Maglia-Rosa dient der vereinsinternen Wertung fuer ZGB Cycling.
            Die Anwendung berechnet und zeigt Wertungsdaten fuer Mitglieder an.
          </p>
        </Article>

        <Article title="Verarbeitete Strava-Daten">
          <p>
            Fuer die Wertung werden nur Daten verarbeitet, die fuer Verbindung,
            Synchronisation, Punkteberechnung und Pruefung erforderlich sind:
          </p>
          <List items={processedData} />
        </Article>

        <Article title="Zwecke der Verarbeitung">
          <List items={purposes} />
        </Article>

        <Article title="Einwilligung und Widerruf">
          <p>
            Die Verbindung erfolgt freiwillig ueber Strava OAuth. Nutzer stimmen
            dabei den angeforderten Scopes <code>read</code> und{" "}
            <code>activity:read</code> zu. Nutzer koennen Strava jederzeit im
            eigenen Profil trennen; danach wird keine weitere Synchronisation
            durchgefuehrt.
          </p>
        </Article>

        <Article title="Loesch- und Bereinigungskonzept">
          <p>
            Strava-Daten werden nur solange gespeichert, wie sie fuer
            Vereinswertung, Nachvollziehbarkeit und Administration erforderlich
            sind. Bei Widerruf oder Loeschwunsch werden Strava-bezogene
            Detaildaten geloescht oder anonymisiert, soweit keine zwingenden
            administrativen Gruende entgegenstehen. Tokens werden entfernt,
            Aktivitaetsnamen anonymisiert und Original-Links, Aktivitaets-IDs,
            Distanzen, Sporttypen sowie genaue Startzeitinformationen bereinigt.
            Aggregierte Wertungsdaten koennen erhalten bleiben, wenn sie fuer
            die Vereinswertung erforderlich sind und keine fremden
            Strava-Rohdaten mehr enthalten.
          </p>
        </Article>

        <Article title="Sichtbarkeit">
          <p>
            Strava-Rohdaten anderer Mitglieder werden nicht angezeigt. Im
            Leaderboard erscheinen nur Name, Punkte, Anzahl gewerteter Fahrten
            und Art bzw. Kategorie der Wertung. Eigene Aktivitaetsdetails sind
            nur im eigenen Profil sichtbar. Detaildaten anderer Nutzer sind nur
            fuer Admins zur Pruefung sichtbar.
          </p>
        </Article>

        <Article title="Keine Weitergabe">
          <p>
            Es erfolgt keine Weitergabe, kein Verkauf, keine Werbung und keine
            Nutzung der Daten fuer KI- oder ML-Modelltraining.
          </p>
        </Article>

        <Article title="Hinweis zu Strava">
          <p>
            Strava-Daten stammen aus der Strava API. Originalaktivitaeten werden
            bei Verlinkung mit dem Linktext{" "}
            <span lang="en">View on Strava</span> verlinkt.
          </p>
        </Article>
      </section>
    </main>
  );
}

function Article({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <article className="border-b border-asphalt-200 pb-5 last:border-b-0">
      <h2 className="text-base font-semibold text-asphalt-900">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </article>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

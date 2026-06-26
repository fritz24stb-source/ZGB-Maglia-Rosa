import { AlertTriangle, Bike, CheckCircle2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const messageByError: Record<string, string> = {
  config:
    "Server-Konfiguration unvollstaendig. Bitte Environment Variables pruefen.",
  invalid_oauth_state:
    "OAuth-Status ungueltig. Bitte Strava-Verbindung erneut starten.",
  missing_strava_scope:
    "Strava-Berechtigungen fehlen. Bitte read und activity:read bestaetigen.",
  strava_callback_failed:
    "Strava-Callback konnte nicht verarbeitet werden. Bitte erneut versuchen.",
  strava_denied: "Strava-Zugriff wurde nicht bestaetigt.",
  strava_error: "Strava hat den Login abgebrochen.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = getSingleParam(params.error);
  const disconnected = getSingleParam(params.disconnected);
  const warning = getSingleParam(params.warning);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Anmelden"
        description="Mitglieder verbinden ihr Konto ueber Strava. Access Tokens und Refresh Tokens bleiben serverseitig."
      />

      {error ? (
        <StatusMessage
          tone="danger"
          icon={<AlertTriangle aria-hidden className="h-5 w-5" />}
          title="Anmeldung fehlgeschlagen"
          message={messageByError[error] ?? messageByError.strava_error}
        />
      ) : null}

      {disconnected ? (
        <StatusMessage
          tone="success"
          icon={<CheckCircle2 aria-hidden className="h-5 w-5" />}
          title="Strava getrennt"
          message="Die lokale Sitzung wurde beendet und die Verbindung wurde als widerrufen markiert."
        />
      ) : null}

      {warning === "strava_revoke_failed" ? (
        <StatusMessage
          tone="warning"
          icon={<AlertTriangle aria-hidden className="h-5 w-5" />}
          title="Hinweis zur Trennung"
          message="Der lokale Status wurde getrennt. Die Strava-Revoke-Anfrage sollte administrativ geprueft werden."
        />
      ) : null}

      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-asphalt-900 p-2 text-white">
              <Bike aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-asphalt-900">
                Strava verbinden
              </h2>
              <p className="mt-1 text-sm leading-6 text-asphalt-600">
                Die App fordert nur die fuer Webhooks und Aktivitaetsimport
                benoetigten Strava-Berechtigungen an.
              </p>
            </div>
          </div>
          <a
            href="/api/strava/connect"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#fc4c02] px-4 text-sm font-semibold text-white shadow-line"
          >
            <ShieldCheck aria-hidden className="h-4 w-4" />
            Mit Strava verbinden
          </a>
        </div>
      </section>
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StatusMessage({
  icon,
  message,
  title,
  tone,
}: {
  icon: React.ReactNode;
  message: string;
  title: string;
  tone: "danger" | "success" | "warning";
}) {
  const toneClasses = {
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <section className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <div className="flex gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
    </section>
  );
}

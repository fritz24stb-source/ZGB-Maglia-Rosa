import { AlertTriangle, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { isAdminPasswordConfigured } from "@/lib/auth/admin-session";

type AdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  config:
    "ADMIN_PASSWORD ist nicht gesetzt. Adminzugriff kann lokal nicht geprueft werden.",
  invalid: "Passwort ungueltig.",
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = getSingleParam(params.error);
  const nextPath = normalizeAdminNextPath(getSingleParam(params.next));
  const configured = isAdminPasswordConfigured();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Admin Login"
        description="Separater Passwortschutz fuer Verwaltung, Regeln, Mitglieder und Export."
      />

      {!configured ? (
        <StatusMessage message={errorMessages.config} />
      ) : error ? (
        <StatusMessage
          message={errorMessages[error] ?? errorMessages.invalid}
        />
      ) : null}

      <section className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <form action="/api/admin/login" method="post" className="grid gap-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="grid gap-1 text-sm font-medium text-asphalt-800">
            Admin Passwort
            <input
              className="focus-ring min-h-11 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900"
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={!configured}
              required
            />
          </label>
          <button
            type="submit"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-asphalt-300"
            disabled={!configured}
          >
            <LockKeyhole aria-hidden className="h-4 w-4" />
            Adminbereich oeffnen
          </button>
        </form>
      </section>
    </main>
  );
}

function StatusMessage({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <div className="flex gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5" />
        <p>{message}</p>
      </div>
    </section>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeAdminNextPath(value: string | undefined) {
  if (
    value &&
    value.startsWith("/admin") &&
    !value.startsWith("/admin/login")
  ) {
    return value;
  }

  return "/admin";
}

import { LogOut } from "lucide-react";
import { AdminSectionGrid } from "@/components/admin-section-grid";
import { PageHeader } from "@/components/page-header";

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Admin"
          description="Zentrale Verwaltung für Saisons, Regeln, Mitglieder, Sync und Export."
        />
        <form action="/api/admin/logout" method="post">
          <button
            type="submit"
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-asphalt-300 px-3 text-sm font-medium text-asphalt-800"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Abmelden
          </button>
        </form>
      </div>
      <AdminSectionGrid />
    </main>
  );
}

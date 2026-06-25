import { AdminSectionGrid } from "@/components/admin-section-grid";
import { PageHeader } from "@/components/page-header";

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Admin"
        description="Zentrale Verwaltung für Saisons, Regeln, Mitglieder, Sync und Export."
      />
      <AdminSectionGrid />
    </main>
  );
}

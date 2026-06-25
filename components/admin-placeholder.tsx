import { PageHeader } from "@/components/page-header";

type AdminPlaceholderProps = {
  title: string;
  description: string;
};

export function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title={title} description={description} />
      <section className="rounded-lg border border-dashed border-asphalt-300 bg-white p-5 text-sm leading-6 text-asphalt-600">
        Diese Seite ist in Phase 1 als Route und Navigationsziel vorbereitet.
        Datenmodell, RLS und serverseitige Aktionen folgen in den Backend-Phasen.
      </section>
    </main>
  );
}

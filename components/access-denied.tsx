import { ShieldX } from "lucide-react";

type AccessDeniedProps = {
  description: string;
  title: string;
};

export function AccessDenied({ description, title }: AccessDeniedProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <div className="flex gap-3">
          <ShieldX aria-hidden className="mt-0.5 h-5 w-5" />
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            <p className="mt-1 text-sm leading-6">{description}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

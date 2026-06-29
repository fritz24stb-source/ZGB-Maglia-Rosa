type AdminFlashProps = {
  error?: string | null;
  status?: string | null;
};

export function AdminFlash({ error, status }: AdminFlashProps) {
  if (!error && !status) {
    return null;
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
        {error}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">
      {status}
    </section>
  );
}

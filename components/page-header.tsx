type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="border-l-4 border-signal-blue pl-4">
      <h1 className="zgb-app-page-title text-2xl sm:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-asphalt-600 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

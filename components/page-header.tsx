type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-normal text-asphalt-900 sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-asphalt-600 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

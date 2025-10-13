interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-4 border-b pb-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  );
}

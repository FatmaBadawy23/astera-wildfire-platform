import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page title block used by every App Shell page: the one h1 (focus target after navigation), an optional status
 * tag beside it, and a short description. A div, not <header>: the app header is the page's only banner landmark.
 */
export function PageHeader({
  title,
  description,
  status,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          {title}
        </h1>
        {status}
      </div>
      {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Standard page frame inside the App Shell: title block, then content. */
export function Page({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6">
      <PageHeader title={title} description={description} />
      {children}
    </div>
  );
}

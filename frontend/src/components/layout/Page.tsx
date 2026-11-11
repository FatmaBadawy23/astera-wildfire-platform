import type { ReactNode } from "react";

/** Standard page frame inside the App Shell: one h1 (focus target on navigation), description, content. */
export function Page({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {/* A div, not <header>: the app header is the page's only banner landmark. */}
      <div className="mb-6">
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

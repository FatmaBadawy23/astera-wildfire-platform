import { useParams } from "react-router";
import { Construction } from "lucide-react";
import type { NavItem } from "@/app/nav";
import { Page } from "@/components/layout/Page";

/**
 * Stage F2 placeholder for an application area. Shows the area's purpose and when it will be built.
 * It deliberately shows **no data** (mock or otherwise).
 */
export function PlaceholderPage({ item }: { item: NavItem }) {
  const { eventId } = useParams();
  return (
    <Page title={item.title} description={item.description}>
      <section aria-label="Page status" className="flex gap-3 rounded-lg border border-dashed border-border-strong bg-surface p-5">
        <Construction className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="grid gap-1 text-sm">
          <p className="font-semibold">Content arrives in stage {item.stage}.</p>
          <p className="text-muted-foreground">This page is a placeholder. No data is shown yet.</p>
          {eventId !== undefined && (
            <p className="text-muted-foreground">
              Requested event ID: <code className="font-mono text-foreground">{eventId}</code>
            </p>
          )}
        </div>
      </section>
    </Page>
  );
}

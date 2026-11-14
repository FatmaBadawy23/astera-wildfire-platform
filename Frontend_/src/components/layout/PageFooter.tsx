import { Link } from "react-router";
import { INFO_PAGES, NAV_ITEMS } from "@/app/nav";
import { NOT_NASA_TEXT } from "@/components/help/SafetyNote";

const link = "inline-flex min-h-6 items-center text-muted-foreground underline-offset-2 hover:text-foreground hover:underline";

/**
 * Footer at the end of every App Shell page except the Fire map (which fills the screen). It sits inside <main>,
 * scrolls with the page and is never fixed. It repeats the destinations and the Learn pages, and names who made
 * the site and where the map background comes from.
 */
export function PageFooter() {
  return (
    <footer data-page-footer className="mt-auto border-t border-border bg-surface print:hidden">
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 text-sm sm:px-6 md:grid-cols-[auto_auto_minmax(0,1fr)] md:gap-10">
        <nav aria-label="Site pages" className="contents">
          <div className="grid content-start gap-1">
            <p className="font-semibold text-foreground-strong">Explore</p>
            <ul className="grid gap-0.5">
              {NAV_ITEMS.map((p) => (
                <li key={p.path}>
                  <Link to={p.path} className={link}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-1">
            <p className="font-semibold text-foreground-strong">Learn</p>
            <ul className="grid gap-0.5">
              {INFO_PAGES.map((p) => (
                <li key={p.path}>
                  <Link to={p.path} className={link}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <div className="grid content-start gap-1 text-xs text-muted-foreground md:justify-self-end md:text-right">
          <p>{NOT_NASA_TEXT}</p>
          <p>Map background and country outlines: Natural Earth (public domain).</p>
        </div>
      </div>
    </footer>
  );
}

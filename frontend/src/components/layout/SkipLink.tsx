import type { MouseEvent } from "react";

/** First Tab stop. Moves focus to <main> without changing the URL. Visible only while focused. */
export function SkipLink() {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main");
    if (!main) return;
    e.preventDefault();
    main.focus();
  }
  return (
    <a
      href="#main"
      onClick={onClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[var(--aw-z-tooltip)] focus:rounded-md focus:border focus:border-border-strong focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-md"
    >
      Skip to main content
    </a>
  );
}

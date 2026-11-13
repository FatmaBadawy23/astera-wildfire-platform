import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { HOW_PATH } from "@/app/nav";
import { useHelp } from "@/components/help/HelpContext";
import { NOT_NASA_TEXT, SafetyNote } from "@/components/help/SafetyNote";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";
import { ArticleContent } from "./ArticleContent";
import { ARTICLES, GUIDE_SECTIONS } from "./guideArticles";

/** Scrolls to and focuses the article named in the URL hash (after the route's own heading focus). */
export function useHashTarget() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!el) return;
      el.scrollIntoView?.({ block: "start" });
      el.querySelector<HTMLElement>("h3, h2")?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [hash, pathname]);
}

/** User Guide: every article, grouped, with a contents list. Plain words first, technical details collapsed. */
export function UserGuidePage() {
  useHashTarget();
  const { openHelp } = useHelp();
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="grid content-start gap-3 lg:col-span-2">
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          User Guide
        </h1>
        <p className="max-w-prose text-muted-foreground">
          How to use Astera Watch and how to read what it shows. Each article starts in everyday words; open “Technical details” for the scientific
          background.
        </p>
      </div>

      <nav aria-label="Guide contents" className="content-start lg:sticky lg:top-4 lg:self-start">
        <ol className="grid gap-4 text-sm">
          {GUIDE_SECTIONS.map((s) => (
            <li key={s.title} className="grid gap-1">
              <p className="font-semibold text-foreground-strong">{s.title}</p>
              <ul className="grid gap-0.5 border-l border-border pl-3">
                {s.articles.map((id) => (
                  <li key={id}>
                    <a href={`#${id}`} className="inline-flex min-h-8 items-center text-primary underline-offset-2 hover:underline">
                      {ARTICLES[id].question}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid content-start gap-10">
        {GUIDE_SECTIONS.map((s) => (
          <section key={s.title} aria-labelledby={`guide-${s.articles[0]}-section`} className="grid gap-4">
            <h2 id={`guide-${s.articles[0]}-section`} className="text-xl font-semibold">
              {s.title}
            </h2>
            {s.articles.map((id) => (
              <article key={id} id={id} className="grid scroll-mt-4 gap-3 rounded-lg border border-border bg-surface p-5" data-guide-article={id}>
                <h3 tabIndex={-1} className="flex flex-wrap items-center gap-2 text-lg font-semibold focus:outline-none focus-visible:outline-solid">
                  {ARTICLES[id].question}
                  {id === "ask" && <StatusTag status="soon" />}
                </h3>
                <div className="text-sm">
                  <ArticleContent article={ARTICLES[id]} />
                </div>
                {id === "ask" && (
                  <div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => openHelp({ tab: "ask" })}>
                      <MessageCircleQuestion aria-hidden="true" />
                      Open Ask Astera
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}
        <div className="flex flex-wrap gap-3">
          <Link to="/" className={buttonVariants()}>
            Go to the Fire map
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link to={HOW_PATH} className={cn(buttonVariants({ variant: "secondary" }))}>
            How it works
          </Link>
        </div>
        <SafetyNote />
        <p className="text-xs text-muted-foreground">{NOT_NASA_TEXT}</p>
      </div>
    </div>
  );
}

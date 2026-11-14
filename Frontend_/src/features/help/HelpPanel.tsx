/**
 * Help panel (Guide + Ask), opened from any screen.
 * - Desktop (≥ 1024 px): docked beside the page (non-modal), so the map stays visible.
 * - Smaller screens: a modal sheet (Radix Dialog).
 * Esc or Close returns focus to whatever opened it.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Dialog, Tabs } from "radix-ui";
import { Link, useLocation } from "react-router";
import { ArrowRight, X } from "lucide-react";
import { GUIDE_PATH, INFO_PAGES } from "@/app/nav";
import { HELP_PANEL_ID, useHelp, type HelpTab } from "@/components/help/HelpContext";
import { NOT_NASA_TEXT, SafetyNote } from "@/components/help/SafetyNote";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";
import { ArticleContent } from "@/features/guide/ArticleContent";
import { ARTICLES, SUGGESTED_QUESTIONS } from "@/features/guide/guideArticles";
import { screenName, topicsFor } from "./helpContent";

const TITLE_ID = "help-title";

const tabClass = cn(
  "h-11 flex-1 text-sm font-semibold text-muted-foreground focus-visible:-outline-offset-4",
  "data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-3px_0_var(--aw-color-primary)]",
);

function GuideTab() {
  const { pathname } = useLocation();
  const { topic, request } = useHelp();
  const listRef = useRef<HTMLDivElement>(null);
  const topics = topicsFor(pathname);

  // A requested topic (e.g. "What this means" in the demo bar) opens and gets focus.
  useEffect(() => {
    if (!topic) return;
    const el = listRef.current?.querySelector<HTMLDetailsElement>(`[data-help-topic="${topic}"]`);
    if (!el) return;
    el.open = true;
    el.querySelector<HTMLElement>("summary")?.focus();
  }, [topic, request]);

  return (
    <div className="grid gap-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">About this screen: {screenName(pathname)}</p>
      <div ref={listRef} className="grid divide-y divide-border rounded-md border border-border">
        {topics.map((t) => (
          <details key={t.id} data-help-topic={t.id} className="group px-3">
            <summary className="flex min-h-11 cursor-pointer items-center py-2 font-medium focus-visible:-outline-offset-2">{t.question}</summary>
            <div className="pb-3 text-sm">
              <ArticleContent article={t} />
            </div>
          </details>
        ))}
      </div>
      <nav aria-label="Learn more" className="grid gap-1 text-sm">
        <p className="font-semibold">Learn more</p>
        <ul className="grid gap-0.5">
          {INFO_PAGES.map((p) => (
            <li key={p.path}>
              <Link to={p.path} className="inline-flex min-h-9 items-center gap-1.5 font-medium text-primary underline underline-offset-2">
                {p.label === "User Guide" ? "The full User Guide" : p.label}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SafetyNote />
      <p className="text-xs text-muted-foreground">{NOT_NASA_TEXT}</p>
    </div>
  );
}

function AskTab() {
  const { askAbout, setTab } = useHelp();
  return (
    <div className="grid gap-4 text-sm">
      <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
        Ask Astera <StatusTag status="soon" />
      </p>
      {askAbout && (
        <p className="rounded-md border border-border bg-background p-3">
          You wanted to ask about: <strong className="font-semibold">{askAbout}</strong>
        </p>
      )}
      <p>The chatbot isn't connected yet, so it can't answer questions here. Until it is, these User Guide articles answer common questions:</p>
      <ul className="grid gap-1.5" aria-label="Common questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <li key={q.article}>
            <Link
              to={`${GUIDE_PATH}#${q.article}`}
              className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border-strong px-3 py-2 font-medium hover:bg-surface-raised"
            >
              {q.question}
              <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <details className="rounded-md border border-border px-3 py-1">
        <summary className="min-h-9 cursor-pointer py-1.5 font-medium text-primary">How the chatbot will answer</summary>
        <div className="pb-2">
          <ArticleContent article={ARTICLES.ask} />
        </div>
      </details>
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setTab("guide")}>
          Back to the Guide
        </Button>
      </div>
      <SafetyNote />
    </div>
  );
}

function PanelBody({ heading }: { heading: ReactNode }) {
  const { tab, setTab, closeHelp } = useHelp();
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        {heading}
        <Button type="button" variant="ghost" size="icon" aria-label="Close help" onClick={closeHelp}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as HelpTab)} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List aria-label="Help sections" className="flex shrink-0 border-b border-border px-2">
          <Tabs.Trigger value="guide" className={tabClass}>
            Guide
          </Tabs.Trigger>
          <Tabs.Trigger value="ask" className={tabClass}>
            Ask Astera
          </Tabs.Trigger>
        </Tabs.List>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Tabs.Content value="guide" className="focus-visible:-outline-offset-2">
            <GuideTab />
          </Tabs.Content>
          <Tabs.Content value="ask" className="focus-visible:-outline-offset-2">
            <AskTab />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </>
  );
}

function returnFocus(opener: HTMLElement | null) {
  const target = opener && opener.isConnected ? opener : document.querySelector<HTMLElement>("[data-help-trigger]");
  window.setTimeout(() => target?.focus(), 0);
}

/** Desktop: docked, non-modal panel beside the page. */
export function HelpAside() {
  const { closeHelp, openerRef, request, topic } = useHelp();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Opening moves focus into the panel (to the heading, or to a requested topic).
  useEffect(() => {
    if (!topic) headingRef.current?.focus();
  }, [request, topic]);

  return (
    <aside
      id={HELP_PANEL_ID}
      aria-labelledby={TITLE_ID}
      data-help-panel="docked"
      className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-surface [@media(max-height:480px)]:h-auto"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          closeHelp();
          returnFocus(openerRef.current);
        }
      }}
    >
      <PanelBody
        heading={
          <h2 id={TITLE_ID} ref={headingRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            Help
          </h2>
        }
      />
    </aside>
  );
}

/** Below 1024 px: modal sheet (bottom sheet on phones, side sheet on tablets). */
export function HelpDialog() {
  const { open, closeHelp, openerRef, topic } = useHelp();
  // A link inside the sheet leads to another page: close the sheet so the page isn't hidden behind it.
  const { key } = useLocation();
  const firstKey = useRef(key);
  useEffect(() => {
    if (key !== firstKey.current) {
      firstKey.current = key;
      closeHelp();
    }
  }, [key, closeHelp]);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && closeHelp()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--aw-z-overlay)]" style={{ background: "var(--aw-scrim)", opacity: "var(--aw-opacity-scrim)" }} />
        <Dialog.Content
          id={HELP_PANEL_ID}
          aria-describedby={undefined}
          data-help-panel="sheet"
          onOpenAutoFocus={(e) => {
            // A requested topic takes focus itself (GuideTab); otherwise Radix focuses the first control.
            if (topic) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus(openerRef.current);
          }}
          className={cn(
            "fixed z-[var(--aw-z-dialog)] flex flex-col bg-surface shadow-lg",
            "inset-x-0 bottom-0 top-[10dvh] rounded-t-xl border-t border-border",
            "md:inset-y-0 md:right-0 md:left-auto md:top-0 md:w-[400px] md:rounded-none md:border-t-0 md:border-l",
          )}
        >
          <PanelBody heading={<Dialog.Title className="font-heading text-lg font-semibold">Help</Dialog.Title>} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

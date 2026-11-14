import { useEffect, useRef } from "react";
import { useLocation, useMatches, useNavigationType } from "react-router";
import { APP_NAME } from "@/app/nav";

export const PAGE_HEADING_SELECTOR = "[data-page-heading]";
/** How long to wait for a page heading that renders late (lazy or slow pages). */
export const HEADING_WAIT_MS = 3000;

interface RouteHandle {
  title?: string;
}

/** Sets the browser tab title from the deepest matched route's `handle.title`. */
export function useDocumentTitle() {
  const matches = useMatches();
  const title = [...matches].reverse().map((m) => (m.handle as RouteHandle | undefined)?.title).find(Boolean);
  useEffect(() => {
    // A page that knows a better title (e.g. the possible fire's name) sets it itself with usePageTitle.
    if (pageTitle) return;
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

let pageTitle: string | null = null;

/** Lets a page set a more specific browser tab title than its route's `handle.title` (null = use the route's). */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    pageTitle = title;
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      pageTitle = null;
    };
  }, [title]);
}

/**
 * Moves focus to the page heading. If the heading isn't rendered yet, focus goes to <main> first and moves
 * to the heading when it appears (up to HEADING_WAIT_MS), unless the user has moved focus in the meantime.
 * Returns a cleanup function.
 */
export function focusPageHeading(): () => void {
  const heading = document.querySelector<HTMLElement>(PAGE_HEADING_SELECTOR);
  if (heading) {
    heading.focus();
    return () => {};
  }

  const main = document.getElementById("main");
  main?.focus();
  const placeholderFocus = document.activeElement;

  const observer = new MutationObserver(() => {
    const late = document.querySelector<HTMLElement>(PAGE_HEADING_SELECTOR);
    if (!late) return;
    stop();
    // Don't take focus away from something the user chose while waiting.
    if (document.activeElement === placeholderFocus || document.activeElement === document.body) late.focus();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = window.setTimeout(stop, HEADING_WAIT_MS);

  function stop() {
    observer.disconnect();
    window.clearTimeout(timer);
  }
  return stop;
}

/**
 * Focus management for route changes:
 * - direct URL load (including an old address redirecting on load): focus is not moved (the skip link stays first);
 * - pathname change (links, Back/Forward, programmatic): focus moves to the page heading;
 * - query-string or hash-only changes: focus is not moved.
 */
export function useRouteFocus() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef(pathname);
  const initial = useRef(true);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    // An old address redirecting straight after a direct load (e.g. /explorer → /) is still a direct load.
    const redirectOnLoad = initial.current && navigationType === "REPLACE";
    initial.current = false;
    if (redirectOnLoad) return;
    return focusPageHeading();
  }, [pathname, navigationType]);
}

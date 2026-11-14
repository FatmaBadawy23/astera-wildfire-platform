import { useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { BookOpen, ChevronDown, CircleHelp } from "lucide-react";
import { INFO_PAGES, NAV_ITEMS } from "@/app/nav";
import { HELP_PANEL_ID, useHelp } from "@/components/help/HelpContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** The three destinations in the header (768 px and wider). Active item: aria-current + underline. */
export function HeaderNav() {
  return (
    <nav aria-label="Main" className="h-full">
      <ul className="flex h-full items-stretch gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.path} className="flex">
            <NavLink
              to={item.path}
              end={!item.hasSubpages}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:-outline-offset-4",
                  isActive && "text-foreground shadow-[inset_0_-3px_0_var(--aw-color-primary)]",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * "Learn" menu (768 px and wider): How it works, User Guide, What's planned. A small non-modal popover; Esc or an
 * outside click closes it and returns focus to the button. Choosing a page closes it without pulling focus back,
 * so focus goes to the new page's heading. Phones reach the same pages from Help.
 */
export function LearnMenu() {
  const [open, setOpen] = useState(false);
  const navigated = useRef(false);
  const { pathname } = useLocation();
  const onInfoPage = INFO_PAGES.some((p) => p.path === pathname);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-learn-trigger
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-raised hover:text-foreground",
          (open || onInfoPage) && "text-foreground",
          open && "bg-surface-raised",
        )}
      >
        <BookOpen className="size-4" aria-hidden="true" />
        Learn
        <ChevronDown className={cn("size-4 transition-transform duration-[var(--aw-duration-fast)]", open && "rotate-180")} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-1.5"
        onCloseAutoFocus={(e) => {
          if (navigated.current) e.preventDefault();
          navigated.current = false;
        }}
      >
        <nav aria-label="Learn">
          <ul className="grid gap-0.5">
            {INFO_PAGES.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.path}>
                  <NavLink
                    to={p.path}
                    onClick={() => {
                      navigated.current = true;
                      setOpen(false);
                    }}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground hover:bg-surface-raised focus-visible:-outline-offset-2",
                        isActive && "bg-surface-raised shadow-[inset_3px_0_0_var(--aw-color-primary)]",
                      )
                    }
                  >
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    {p.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </PopoverContent>
    </Popover>
  );
}

/** Help button for the header. */
export function HelpButton() {
  const { open, toggleHelp } = useHelp();
  return (
    <button
      type="button"
      data-help-trigger
      aria-expanded={open}
      aria-controls={open ? HELP_PANEL_ID : undefined}
      onClick={toggleHelp}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground hover:bg-surface-raised",
        open && "bg-surface-raised",
      )}
    >
      <CircleHelp className="size-5 text-primary" aria-hidden="true" />
      Help
    </button>
  );
}

const tab = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium text-muted-foreground focus-visible:-outline-offset-4";

/** Phone tab bar (below 768 px): the three destinations + Help. A grid row of the shell, never covering content. */
export function BottomNav() {
  const { open, toggleHelp } = useHelp();
  return (
    <div data-bottom-nav className="flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <nav aria-label="Main" className="flex flex-[3]">
        <ul className="flex flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path} className="flex flex-1">
                <NavLink
                  to={item.path}
                  end={!item.hasSubpages}
                  className={({ isActive }) => cn(tab, isActive && "text-primary shadow-[inset_0_3px_0_var(--aw-color-primary)]")}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span>{item.shortLabel}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <button
        type="button"
        data-help-trigger
        aria-expanded={open}
        aria-controls={open ? HELP_PANEL_ID : undefined}
        onClick={toggleHelp}
        className={cn(tab, open && "text-primary shadow-[inset_0_3px_0_var(--aw-color-primary)]")}
      >
        <CircleHelp className="size-5" aria-hidden="true" />
        <span>Help</span>
      </button>
    </div>
  );
}

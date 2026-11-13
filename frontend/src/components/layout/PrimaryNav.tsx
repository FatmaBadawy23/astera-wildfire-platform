import { NavLink } from "react-router";
import { CircleHelp } from "lucide-react";
import { HOW_PATH, NAV_ITEMS } from "@/app/nav";
import { HELP_PANEL_ID, useHelp } from "@/components/help/HelpContext";
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
              end
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

/** Secondary information link (1024 px and wider; smaller screens reach it from Help). */
export function HowItWorksLink() {
  return (
    <NavLink
      to={HOW_PATH}
      className={({ isActive }) =>
        cn(
          "inline-flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-surface-raised hover:text-foreground",
          isActive && "text-foreground underline underline-offset-4",
        )
      }
    >
      How it works
    </NavLink>
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
                  end
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

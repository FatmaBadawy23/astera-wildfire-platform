import { NavLink, Link } from "react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, APP_NAME, type NavItem } from "@/app/nav";
import { LogoLockup, ProductMark } from "@/components/brand/Logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const SIDEBAR_NAV_ID = "sidebar-nav";

/**
 * Nav item: 44px tall; active = raised fill + accent bar + aria-current="page" (set by NavLink);
 * focus = inset ring (D.2 §7: 2px ring, 2px inside the item).
 */
function NavItemLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors",
          "hover:bg-surface-raised hover:text-foreground focus-visible:-outline-offset-4",
          collapsed && "justify-center px-0",
          isActive &&
            "bg-surface-raised text-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary",
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/** The list of seven areas. Shared by the docked sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate, id }: { collapsed?: boolean; onNavigate?: () => void; id?: string }) {
  return (
    <nav aria-label="Main" id={id}>
      <ul className="grid gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.path}>
            <NavItemLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Docked sidebar (desktop and rail modes): 240px expanded, 72px collapsed. Scrolls on its own. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <div
      data-sidebar="docked"
      data-collapsed={collapsed}
      className={cn(
        "z-[var(--aw-z-sidebar)] flex h-full shrink-0 flex-col overflow-y-auto border-r border-border bg-surface",
        "transition-[width] duration-[var(--aw-duration-slow)] [@media(max-height:480px)]:h-auto [@media(max-height:480px)]:overflow-visible",
        collapsed ? "w-[var(--aw-size-sidebar-collapsed)]" : "w-[var(--aw-size-sidebar-expanded)]",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center px-3", collapsed && "justify-center px-0")}>
        <Link
          to="/explorer"
          aria-label={`${APP_NAME}, go to Explorer`}
          className="flex items-center rounded-md p-1"
        >
          {collapsed ? <ProductMark size={32} /> : <LogoLockup layout="compact" />}
        </Link>
      </div>

      <div className={cn("flex-1 px-3 py-2", collapsed && "px-2")}>
        <SidebarNav collapsed={collapsed} id={SIDEBAR_NAV_ID} />
      </div>

      <div className={cn("shrink-0 border-t border-border p-3", collapsed && "flex justify-center px-2")}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={SIDEBAR_NAV_ID}
          aria-label={toggleLabel}
          title={toggleLabel}
          className={cn(
            "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-raised hover:text-foreground",
            collapsed ? "w-11 justify-center px-0" : "w-full",
          )}
        >
          <ToggleIcon className="size-5 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}

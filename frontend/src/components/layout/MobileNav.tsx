import { Dialog } from "radix-ui";
import { Link } from "react-router";
import { X } from "lucide-react";
import { LogoLockup } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./Sidebar";

export const MOBILE_NAV_ID = "mobile-nav";

export type DrawerCloseReason = "dismiss" | "navigate";

interface MobileNavProps {
  open: boolean;
  onClose: (reason: DrawerCloseReason) => void;
  /** Called when the drawer has closed and Radix would restore focus; return true to take over focus. */
  onCloseAutoFocus: (event: Event) => void;
}

/**
 * Navigation drawer for widths below 768px. Modal (Radix Dialog): focus stays inside while open,
 * Esc / outside click / close button dismiss it, the page behind can't receive focus.
 */
export function MobileNav({ open, onClose, onCloseAutoFocus }: MobileNavProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose("dismiss")}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[var(--aw-z-overlay)]"
          style={{ background: "var(--aw-scrim)", opacity: "var(--aw-opacity-scrim)" }}
        />
        <Dialog.Content
          id={MOBILE_NAV_ID}
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-y-0 left-0 z-[var(--aw-z-dialog)] flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-lg"
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <LogoLockup layout="compact" />
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close navigation menu">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <SidebarNav onNavigate={() => onClose("navigate")} />
          </div>
          <div className="shrink-0 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            Browsing as <span className="font-medium text-foreground">Guest</span> ·{" "}
            <Link to="/login" onClick={() => onClose("navigate")} className="font-medium text-primary underline underline-offset-2">
              Log in
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

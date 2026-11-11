import type { Ref } from "react";
import { Link } from "react-router";
import { Bot, Menu } from "lucide-react";
import { APP_NAME } from "@/app/nav";
import { ProductMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { MOBILE_NAV_ID } from "./MobileNav";

interface HeaderProps {
  mobile: boolean;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  menuButtonRef: Ref<HTMLButtonElement>;
}

/** 56px header row of the app frame. Never overlaps content (it is a grid row, not sticky/fixed). */
export function Header({ mobile, drawerOpen, onOpenDrawer, menuButtonRef }: HeaderProps) {
  return (
    <header className="z-[var(--aw-z-header)] flex h-[var(--aw-size-header)] items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
      {mobile && (
        <>
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-controls={drawerOpen ? MOBILE_NAV_ID : undefined}
            onClick={onOpenDrawer}
          >
            <Menu aria-hidden="true" />
          </Button>
          <Link to="/explorer" aria-label={`${APP_NAME}, go to Explorer`} className="rounded-md p-1">
            <ProductMark size={32} />
          </Link>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Button asChild variant="ghost" className="px-3">
          <Link to="/assistant" aria-label="AI Assistant">
            <Bot aria-hidden="true" />
            <span className="hidden sm:inline">Assistant</span>
          </Link>
        </Button>
        <div className="hidden items-center gap-1 text-sm sm:flex">
          <span className="text-muted-foreground">Guest</span>
          <Button asChild variant="link" className="px-2">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
